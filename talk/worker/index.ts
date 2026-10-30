import { DurableObject } from 'cloudflare:workers'
import { POLLS, poll, score } from '../shared/polls'
import type { ClientMessage, Me, PollStatus, PollView, Role, RoomState, ServerMessage } from '../shared/protocol'

interface Env {
  ROOM: DurableObjectNamespace<Room>
  PRESENTER_KEY: string
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname !== '/api/ws') return new Response('Not found', { status: 404 })
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const role = url.searchParams.get('role')
    if (role !== 'audience' && role !== 'presenter' && role !== 'notes') {
      return new Response('Bad role', { status: 400 })
    }
    if (role !== 'audience' && (!env.PRESENTER_KEY || url.searchParams.get('key') !== env.PRESENTER_KEY)) {
      return new Response('Wrong presenter key', { status: 403 })
    }
    return env.ROOM.get(env.ROOM.idFromName('main')).fetch(request)
  },
} satisfies ExportedHandler<Env>

interface Stored {
  slide: number
  step: number
  polls: Record<string, PollStatus>
  players: Record<string, { name: string }>
  votes: Record<string, Record<string, string | number>>
}

interface Attachment {
  role: Role
  id: string
}

const initial = (): Stored => ({ slide: 0, step: 0, polls: {}, players: {}, votes: {} })

export class Room extends DurableObject<Env> {
  private s: Stored = initial()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get<Stored>('state')) ?? initial()
    })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const attachment: Attachment = {
      role: url.searchParams.get('role') as Role,
      id: (url.searchParams.get('id') ?? '').slice(0, 64) || crypto.randomUUID(),
    }
    const [client, server] = Object.values(new WebSocketPair())
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment(attachment)
    this.send(server, attachment, this.scores())
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const att = ws.deserializeAttachment() as Attachment
    let msg: ClientMessage
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw))
    } catch {
      return
    }
    const error = this.apply(att, msg)
    if (error) {
      ws.send(JSON.stringify({ t: 'error', message: error } satisfies ServerMessage))
      return
    }
    await this.ctx.storage.put('state', this.s)
    this.broadcast()
  }

  async webSocketClose(ws: WebSocket, code: number) {
    ws.close(code)
  }

  private apply(att: Attachment, msg: ClientMessage): string | undefined {
    const s = this.s
    if (msg.t === 'join') {
      const name = String(msg.name).trim().slice(0, 24)
      if (!name) return 'Pick a name'
      s.players[att.id] = { name }
      return
    }
    if (msg.t === 'vote') {
      if (!s.players[att.id]) return 'Join first'
      if (!POLLS.some((p) => p.id === msg.pollId)) return 'Unknown poll'
      if (s.polls[msg.pollId] !== 'open') return 'Voting is closed'
      const p = poll(msg.pollId)
      const value = p.kind === 'choice' ? String(msg.value) : Number(msg.value)
      if (p.kind === 'choice' && !p.options.some((o) => o.id === value)) return 'Unknown option'
      if (p.kind === 'number' && !(Number(value) > 0)) return 'Guess a positive number'
      ;(s.votes[msg.pollId] ??= {})[att.id] = value
      return
    }
    if (att.role !== 'presenter') return 'Presenter only'
    if (msg.t === 'reset') {
      this.s = initial()
      return
    }
    if (msg.t === 'goto') {
      s.slide = Math.max(0, Math.floor(msg.slide))
      s.step = Math.max(0, Math.floor(msg.step))
      if (msg.open && (s.polls[msg.open] ?? 'closed') === 'closed') s.polls[msg.open] = 'open'
      if (msg.reveal) s.polls[msg.reveal] = 'revealed'
    }
  }

  private scores() {
    const totals: Record<string, number> = {}
    const points: Record<string, Record<string, number>> = {}
    for (const id of Object.keys(this.s.players)) totals[id] = 0
    for (const p of POLLS) {
      if (this.s.polls[p.id] !== 'revealed') continue
      for (const [player, value] of Object.entries(this.s.votes[p.id] ?? {})) {
        const pts = score(p, value)
        totals[player] = (totals[player] ?? 0) + pts
        ;(points[player] ??= {})[p.id] = pts
      }
    }
    const ranked = Object.entries(totals)
      .filter(([id]) => this.s.players[id])
      .sort((a, b) => b[1] - a[1])
    return { totals, points, ranked }
  }

  private view(att: Attachment, sc: ReturnType<Room['scores']>): RoomState {
    const polls: Record<string, PollView> = {}
    for (const p of POLLS) {
      const status = this.s.polls[p.id] ?? 'closed'
      const votes = Object.values(this.s.votes[p.id] ?? {})
      const view: PollView = { status, votes: votes.length }
      if (status === 'revealed') {
        if (p.kind === 'choice') {
          view.tally = {}
          for (const v of votes) view.tally[String(v)] = (view.tally[String(v)] ?? 0) + 1
        } else {
          view.guesses = votes.map(Number)
        }
      }
      polls[p.id] = view
    }
    const state: RoomState = {
      slide: this.s.slide,
      step: this.s.step,
      players: Object.keys(this.s.players).length,
      polls,
      leaderboard: sc.ranked.slice(0, 10).map(([id, score]) => ({ name: this.s.players[id].name, score })),
    }
    if (att.role === 'audience') {
      const rankIndex = sc.ranked.findIndex(([id]) => id === att.id)
      const me: Me = {
        id: att.id,
        name: this.s.players[att.id]?.name ?? null,
        score: sc.totals[att.id] ?? 0,
        rank: rankIndex >= 0 ? rankIndex + 1 : null,
        votes: {},
        points: sc.points[att.id] ?? {},
      }
      for (const p of POLLS) {
        const v = this.s.votes[p.id]?.[att.id]
        if (v !== undefined) me.votes[p.id] = v
      }
      state.me = me
    }
    return state
  }

  private send(ws: WebSocket, att: Attachment, sc: ReturnType<Room['scores']>) {
    try {
      ws.send(JSON.stringify({ t: 'state', state: this.view(att, sc) } satisfies ServerMessage))
    } catch {
      // socket already closing
    }
  }

  private broadcast() {
    const sc = this.scores()
    for (const ws of this.ctx.getWebSockets()) {
      this.send(ws, ws.deserializeAttachment() as Attachment, sc)
    }
  }
}

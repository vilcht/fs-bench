import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Poll, describeRatio, fmtRatio, metricValue, poll } from '../shared/polls'
import { cfg } from '../shared/data'
import type { ClientMessage, Cursor, Me, PollView } from '../shared/protocol'
import { Cursors, useCursorReporter } from './Cursors'
import { SLIDES, type SlideCtx, type SlideDef, slideHasMock } from './deck'
import { Stage } from './Stage'
import { fmtSeconds } from './theme'
import { useRoom } from './useRoom'

export function App() {
  const path = location.pathname
  if (path.startsWith('/present')) return <Presenter />
  if (path.startsWith('/notes')) return <Notes />
  return <Audience />
}

const joinUrl = () => location.origin

/** Slide plus its chrome: sector-grid backdrop, status rail, fade between slides, mock badge. */
function SlideFrame({
  index,
  ctx,
  connected,
  cursors,
  self,
}: {
  index: number
  ctx: SlideCtx
  connected: boolean
  cursors?: Cursor[]
  self?: string | null
}) {
  const slide: SlideDef = SLIDES[index]
  const view = slide.poll ? ctx.state?.polls[slide.poll] : undefined
  return (
    <div className={slide.bleed ? 'frame bleed' : 'frame'}>
      <div className="slide-fade" key={index}>
        {slide.render(ctx)}
      </div>
      {slideHasMock(slide) && <div className="mock-badge">Mock data</div>}
      <footer className="rail">
        <span className="rail-progress" aria-label={`Slide ${index + 1} of ${SLIDES.length}`}>
          {SLIDES.map((s, i) => (
            <i key={s.id} className={i < index ? 'done' : i === index ? 'now' : s.poll ? 'poll' : ''} />
          ))}
        </span>
        <span className="rail-title">{slide.title}</span>
        <span className="rail-stats">
          {ctx.state?.players ?? 0} players
          {view && view.status === 'open' && ` · ${view.votes} votes`}
          <span className={`dot ${connected ? 'ok' : 'bad'}`} />
        </span>
      </footer>
      {cursors && <Cursors cursors={cursors} exclude={self} />}
    </div>
  )
}

/** Reads ?key= once, keeps it in sessionStorage and drops it from the address bar (screen share). */
function usePresenterKey() {
  return useMemo(() => {
    const url = new URL(location.href)
    const fromUrl = url.searchParams.get('key')
    if (fromUrl) {
      sessionStorage.setItem('fsbench-key', fromUrl)
      url.searchParams.delete('key')
      history.replaceState(null, '', url)
    }
    return sessionStorage.getItem('fsbench-key') ?? ''
  }, [])
}

function clampSlide(i: number) {
  return Math.min(Math.max(0, i), SLIDES.length - 1)
}

function Presenter() {
  const key = usePresenterKey()
  const { state, cursors, connected, send } = useRoom('presenter', { key })
  const [pos, setPos] = useState<{ slide: number; step: number } | null>(null)

  useEffect(() => {
    if (state && !pos) setPos({ slide: clampSlide(state.slide), step: state.step })
  }, [state, pos])

  const go = useCallback(
    (slide: number, step: number) => {
      const s = SLIDES[slide]
      setPos({ slide, step })
      const msg: ClientMessage = { t: 'goto', slide, step }
      if (s.poll && step === 0) msg.open = s.poll
      if (s.poll && step === 1) msg.reveal = s.poll
      send(msg)
    },
    [send],
  )

  useEffect(() => {
    if (!pos) return
    const onKey = (e: KeyboardEvent) => {
      const cur = SLIDES[pos.slide]
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault()
        if (cur.poll && pos.step === 0) go(pos.slide, 1)
        else if (pos.slide < SLIDES.length - 1) go(pos.slide + 1, 0)
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault()
        if (pos.step > 0) go(pos.slide, pos.step - 1)
        else if (pos.slide > 0) {
          const prev = SLIDES[pos.slide - 1]
          go(pos.slide - 1, prev.poll && state?.polls[prev.poll]?.status === 'revealed' ? 1 : 0)
        }
      } else if (e.key === 'f') {
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen()
      } else if (e.key === 'R' && confirm('Reset all votes, players and scores?')) {
        send({ t: 'reset' })
        setPos({ slide: 0, step: 0 })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pos, go, send, state])

  if (!key) return <Centered>Open /present?key=… with the presenter key.</Centered>
  if (!pos) return <Centered>{connected ? 'Loading…' : 'Connecting… (wrong key?)'}</Centered>
  return (
    <div className="presenter">
      <Stage>
        <SlideFrame index={pos.slide} ctx={{ step: pos.step, state, joinUrl: joinUrl() }} connected={connected} cursors={cursors} />
      </Stage>
    </div>
  )
}

function Notes() {
  const key = usePresenterKey()
  const { state, connected } = useRoom('notes', { key })
  const [start] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  if (!key) return <Centered>Open /notes?key=… with the presenter key.</Centered>
  if (!state) return <Centered>{connected ? 'Loading…' : 'Connecting…'}</Centered>
  const i = clampSlide(state.slide)
  const slide = SLIDES[i]
  const next = SLIDES[i + 1]
  const elapsed = Math.floor((now - start) / 1000)
  const view = slide.poll ? state.polls[slide.poll] : undefined
  return (
    <div className="notes">
      <div className="notes-top tnum">
        <span>
          {i + 1}/{SLIDES.length} · {slide.title}
          {slide.poll && ` · step ${state.step + 1}/2`}
        </span>
        <span>
          {state.players} players{view && ` · ${view.votes} votes`} · {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
          <span className={`dot ${connected ? 'ok' : 'bad'}`} />
        </span>
      </div>
      <div className="notes-preview">
        <Stage>
          <SlideFrame index={i} ctx={{ step: state.step, state, joinUrl: joinUrl() }} connected={connected} />
        </Stage>
      </div>
      <p className="notes-text">{slide.notes}</p>
      {slide.poll && <p className="notes-answer">Answer: {answerText(poll(slide.poll))}</p>}
      {next && <p className="notes-next">Next: {next.title}</p>}
    </div>
  )
}

function answerText(p: Poll) {
  return `${fmtRatio(p.answer)} (${fmtSeconds(metricValue(cfg(p.target), p.metric))} vs ${fmtSeconds(metricValue(cfg(p.base), p.metric))})`
}

function playerId() {
  let id = localStorage.getItem('fsbench-player')
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem('fsbench-player', id)
  }
  return id
}

function Audience() {
  const id = useMemo(playerId, [])
  const { state, cursors, connected, error, send } = useRoom('audience', { id })
  const slideArea = useRef<HTMLDivElement>(null)
  const pointer = useCursorReporter(slideArea, send)
  if (!state) return <Centered>{connected ? 'Loading…' : 'Connecting…'}</Centered>
  const me = state.me
  if (!me?.name) return <JoinForm onJoin={(name) => send({ t: 'join', name })} error={error} />
  const slide = SLIDES[clampSlide(state.slide)]
  const p = slide.poll ? poll(slide.poll) : undefined
  return (
    <div className="audience">
      <header className="me tnum">
        <span>{me.name}</span>
        <span>
          {me.score.toLocaleString('en-US')} pts{me.rank && ` · #${me.rank}`}
          <span className={`dot ${connected ? 'ok' : 'bad'}`} />
        </span>
      </header>
      <div className="audience-slide" ref={slideArea} {...pointer}>
        <Stage>
          <SlideFrame
            index={clampSlide(state.slide)}
            ctx={{ step: state.step, state, joinUrl: joinUrl() }}
            connected={connected}
            cursors={cursors}
            self={me.cursorId}
          />
        </Stage>
      </div>
      <div className="vote-panel">
        {p ? (
          <VotePanel key={p.id} p={p} view={state.polls[p.id]} me={me} send={send} error={error} />
        ) : (
          <p className="muted">Follow along. Voting opens on question slides.</p>
        )}
      </div>
    </div>
  )
}

function JoinForm({ onJoin, error }: { onJoin: (name: string) => void; error: string | null }) {
  const [name, setName] = useState('')
  return (
    <div className="centered">
      <form
        className="join-form"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim()) onJoin(name.trim())
        }}
      >
        <h1>16 agents, one SSD</h1>
        <p className="muted">Pick a name for the leaderboard.</p>
        <input autoFocus maxLength={24} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <button type="submit" disabled={!name.trim()}>
          Join
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  )
}

function VotePanel({
  p,
  view,
  me,
  send,
  error,
}: {
  p: Poll
  view?: PollView
  me: Me
  send: (m: ClientMessage) => void
  error: string | null
}) {
  const status = view?.status ?? 'closed'
  const mine = me.votes[p.id]
  if (status === 'closed') return <p className="muted">Voting opens in a moment.</p>
  if (status === 'revealed') {
    const pts = me.points[p.id]
    return (
      <div className="result">
        <div className="result-answer">Answer: {answerText(p)}</div>
        {mine === undefined ? (
          <div className="muted">You didn't vote on this one.</div>
        ) : (
          <div className={pts ? 'result-points good' : 'result-points'}>+{pts ?? 0} points</div>
        )}
      </div>
    )
  }
  const base = cfg(p.base)
  const target = cfg(p.target)
  return (
    <div className="vote">
      <div className="vote-q">
        {target.machineName} <span className="muted">vs</span> {base.machineName}
      </div>
      <div className="vote-known">
        {base.name}: <b>{fmtSeconds(metricValue(base, p.metric))}</b>
      </div>
      <RatioVote key={p.id} p={p} mine={mine} baseValue={metricValue(base, p.metric)} onVote={(v) => send({ t: 'vote', pollId: p.id, value: v })} />
      <p className="muted small">Your guess is sent as you drag. Change it any time until the reveal.</p>
      {error && <p className="error">{error}</p>}
    </div>
  )
}

/** Log-scale multiple slider; sends the guess shortly after the user stops dragging. */
function RatioVote({ p, mine, baseValue, onVote }: { p: Poll; mine?: number; baseValue: number; onVote: (v: number) => void }) {
  const [value, setValue] = useState(mine ?? 1)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const lmin = Math.log(p.min)
  const lmax = Math.log(p.max)
  const pos = (Math.log(value) - lmin) / (lmax - lmin)
  const set = (v: number) => {
    const rounded = +v.toPrecision(2)
    setValue(rounded)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onVote(rounded), 250)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const synced = mine !== undefined && Math.abs(mine - value) < 1e-9
  return (
    <div className="ratio-vote">
      <div className="ratio-readout">{describeRatio(value)}</div>
      <div className="ratio-seconds">
        ≈ {fmtSeconds(value * baseValue)} <span className={synced ? 'sent ok' : 'sent'}>{synced ? 'sent' : mine === undefined ? 'not sent yet' : 'sending…'}</span>
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(Math.min(1, Math.max(0, pos)) * 1000)}
        onChange={(e) => set(Math.exp(lmin + (Number(e.target.value) / 1000) * (lmax - lmin)))}
        aria-label="How many times as long"
      />
      <div className="ratio-ends">
        <span>{fmtRatio(p.min)}</span>
        <span className="ratio-one" style={{ left: `${(-lmin / (lmax - lmin)) * 100}%` }}>
          1×
        </span>
        <span>{fmtRatio(p.max)}</span>
      </div>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="centered">{children}</div>
}


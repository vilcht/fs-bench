import type { ReactNode } from 'react'
import { type Config, NS, cfg, configs, phaseTime, setupTime } from '../shared/data'
import { type ChoicePoll, type NumberPoll, poll } from '../shared/polls'
import type { RoomState } from '../shared/protocol'
import { Bars } from './charts/Bars'
import { Columns } from './charts/Columns'
import { Guesses } from './charts/Guesses'
import { Lines } from './charts/Lines'
import { Race } from './charts/Race'
import { JoinCard } from './JoinCard'
import { familyColor, fmtSeconds, fmtTimes } from './theme'

export interface SlideCtx {
  step: number
  state: RoomState | null
  joinUrl: string
}

export interface SlideDef {
  id: string
  title: string
  /** Poll slides have two steps: 0 = voting open, 1 = revealed. */
  poll?: string
  notes: string
  /** Config ids drawn on the slide; any mock among them puts a MOCK DATA badge on it. */
  sources?: string[]
  render: (ctx: SlideCtx) => ReactNode
}

const REPO_URL = 'github.com/vilcht/fs-bench'
const W = 1408 // content width inside the slide padding

const RACE_LABELS: Record<string, string> = {
  'macbook:apfs': 'MacBook · macOS',
  'desktop:ext4': 'Desktop · Linux',
  'huawei:home-ext4': 'Huawei · Linux',
  'desktop-win:ntfs': 'Desktop · Windows',
}

const SCALING = ['macbook:apfs', 'macmini:apfs', 'desktop:ext4', 'huawei:home-ext4', 'desktop-win:ntfs']
const LINUX_FS = ['desktop:ext4', 'desktop:xfs', 'desktop:btrfs']
const MACS = ['macbook:apfs', 'macbook:apfs-noindex', 'macmini:apfs', 'macmini:apfs-noindex']

function choiceBars(p: ChoicePoll, n: number) {
  return p.options
    .map((o) => {
      const c = cfg(o.id)
      return {
        id: o.id,
        label: o.label,
        sub: c.stackName,
        value: setupTime(c, n),
        color: familyColor(c.family),
        note: o.id === p.answer ? 'fastest' : undefined,
      }
    })
    .sort((a, b) => a.value - b.value)
}

export const SLIDES: SlideDef[] = [
  {
    id: 'title',
    title: 'Title',
    notes: 'Hi! 10 minutes on why the machine you run agents on matters more than you think. Join on your phone or laptop now: there are points to win.',
    render: ({ state, joinUrl }) => (
      <div className="slide title-slide">
        <div>
          <div className="kicker">Knowledge sharing · filesystems for agentic development</div>
          <h1 className="hero">16 agents, one SSD</h1>
          <p className="lead">
            Every coding agent wants its own copy of the repo. What happens to your machine when sixteen of them start at once?
          </p>
        </div>
        <JoinCard url={joinUrl} players={state?.players ?? 0} />
      </div>
    ),
  },
  {
    id: 'workflow',
    title: 'How agents work in parallel',
    notes:
      'Each agent gets a git worktree so they do not step on each other. Each worktree needs its own node_modules. That is a lot of tiny files, and tiny files are exactly what filesystems are worst at.',
    render: () => (
      <div className="slide">
        <div className="kicker">The setup</div>
        <h2>One agent = one worktree = one install</h2>
        <div className="flow">
          <div className="flow-step">
            <code>git worktree add</code>
            <span>a fresh checkout per agent</span>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <code>pnpm install</code>
            <span>its own node_modules</span>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <code>…agent works…</code>
            <span>git status, builds, tests</span>
          </div>
          <div className="flow-arrow">→</div>
          <div className="flow-step">
            <code>git worktree remove</code>
            <span>throw it all away</span>
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="stat-value">11.7k</div>
            <div className="stat-label">files checked out (l2beat)</div>
          </div>
          <div className="stat">
            <div className="stat-value">56k</div>
            <div className="stat-label">files and links in node_modules</div>
          </div>
          <div className="stat">
            <div className="stat-value">1.1M</div>
            <div className="stat-label">created and deleted by 16 agents</div>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'lineup',
    title: 'The benchmark and the lineup',
    notes:
      'Same l2beat commit, same Node and pnpm everywhere, offline installs from a warm store, so the network is out of the picture. 1, 2, 4, 8 and 16 agents at once, three reps each, median. Plus a CPU-only baseline so we can tell slow disks from slow CPUs.',
    render: () => {
      const machines = [...new Map(configs.map((c) => [c.machine, c])).values()]
      return (
        <div className="slide">
          <div className="kicker">The benchmark</div>
          <h2>Same repo, same commit, same tools. Different machines.</h2>
          <p className="lead small">
            Checkout → install → status → delete, with 1, 2, 4, 8 and 16 agents at once. Offline installs, median of 3 runs.
          </p>
          <div className="lineup">
            {machines.map((m) => (
              <div className="machine" key={m.machine}>
                <div className="machine-name">{m.machineName}</div>
                <div className="machine-detail">{m.machineDetail}</div>
                <div className="chips">
                  {configs
                    .filter((c) => c.machine === m.machine)
                    .map((c) => (
                      <span className="chip" key={c.id}>
                        <i style={{ background: familyColor(c.family) }} />
                        {c.stackName}
                      </span>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )
    },
  },
  {
    id: 'poll-one-agent',
    title: 'Vote: one agent',
    poll: 'one-agent',
    notes: 'Warm-up. One agent, no contention. Reveal shows checkout + install time.',
    sources: poll('one-agent').sources,
    render: (ctx) => {
      const p = poll('one-agent') as ChoicePoll
      return (
        <PollSlide p={p} ctx={ctx} index={1}>
          <Bars items={choiceBars(p, 1)} width={W - 380} format={fmtSeconds} />
        </PollSlide>
      )
    },
  },
  {
    id: 'poll-sixteen',
    title: 'Vote: sixteen agents (race)',
    poll: 'sixteen',
    notes: 'Now the real workload. The reveal replays the recorded run: every line is one agent, faint = checkout, solid = install.',
    sources: poll('sixteen').sources,
    render: (ctx) => {
      const p = poll('sixteen') as ChoicePoll
      return (
        <PollSlide p={p} ctx={ctx} index={2}>
          <Race configs={p.options.map((o) => cfg(o.id))} phases={['worktree_add', 'install']} width={W - 380} playing={ctx.step === 1} labels={RACE_LABELS} />
        </PollSlide>
      )
    },
  },
  {
    id: 'scaling',
    title: 'Cost per agent as they pile up',
    notes:
      'Total time divided by agents. Flat or falling means the machine keeps up: running in parallel is free. Rising means agents are queueing behind each other inside the OS.',
    sources: SCALING,
    render: () => (
      <div className="slide">
        <div className="kicker">Scaling</div>
        <h2>Seconds per agent, as more agents start at once</h2>
        <Lines
          series={SCALING.map((id) => {
            const c = cfg(id)
            return {
              id,
              label: c.name,
              color: familyColor(c.family),
              points: NS.map((n) => ({ x: n, y: setupTime(c, n) / n })),
            }
          })}
          xs={NS}
          width={W}
          height={620}
          yFormat={(v) => `${v.toFixed(v < 10 ? 1 : 0)} s`}
          xLabel="agents starting at once"
        />
      </div>
    ),
  },
  {
    id: 'why-macos',
    title: 'Why: macOS',
    notes:
      'YOUR EXPLANATION. Points to verify before presenting: (1) APFS metadata is copy-on-write B-trees, so each create/delete rewrites tree nodes rather than updating in place. (2) Spotlight (mds) indexes new files; XProtect / endpoint security see file events. The .noindex runs isolate Spotlight. (3) Per-call kernel overhead: an install is hundreds of thousands of small file system calls.',
    render: () => (
      <div className="slide">
        <div className="kicker">Why</div>
        <h2>Where the time goes on a Mac</h2>
        <div className="cards">
          <div className="card">
            <h3>Copy-on-write metadata</h3>
            <p>APFS never updates metadata in place. Every file created or deleted rewrites parts of its B-trees.</p>
          </div>
          <div className="card">
            <h3>Someone reads every new file</h3>
            <p>Spotlight indexes what you write, and security scanning sees every file event. 56k files per install.</p>
          </div>
          <div className="card">
            <h3>Small calls, many of them</h3>
            <p>An install is a storm of tiny open, mkdir, link and stat calls. Per-call overhead decides the result.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'linux-fs',
    title: 'Copy-on-write on Linux too',
    notes:
      'Linux is not magic either. btrfs is copy-on-write like APFS, and on the same disk it is the slowest of the three. Same hardware, same kernel, only the filesystem changes.',
    sources: LINUX_FS,
    render: () => (
      <div className="slide">
        <div className="kicker">Same disk, same kernel</div>
        <h2>It's the filesystem: Linux with three of them</h2>
        <div className="two-col">
          <div>
            <h3 className="chart-title">16 agents: checkout + install</h3>
            <Bars
              items={LINUX_FS.map((id) => fsBar(cfg(id), setupTime(cfg(id), 16)))}
              width={680}
              labelWidth={110}
              format={fmtSeconds}
            />
          </div>
          <div>
            <h3 className="chart-title">16 agents: delete worktrees</h3>
            <Bars
              items={LINUX_FS.map((id) => fsBar(cfg(id), phaseTime(cfg(id), 'remove', 16)))}
              width={680}
              labelWidth={110}
              format={fmtSeconds}
            />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'poll-mac-remove',
    title: 'Vote: MacBook deleting 16 worktrees',
    poll: 'mac-remove',
    notes: 'Extrapolate! Deleting is the step nobody thinks about, and often the slowest.',
    sources: poll('mac-remove').sources,
    render: (ctx) => {
      const p = poll('mac-remove') as NumberPoll
      const c = cfg('macbook:apfs')
      const max = Math.max(...NS.map((n) => phaseTime(c, 'remove', n)))
      return (
        <PollSlide p={p} ctx={ctx} index={3}>
          <Columns
            columns={NS.map((n) => ({ label: n === 1 ? '1 agent' : `${n} agents`, value: phaseTime(c, 'remove', n), hidden: n === 16 && ctx.step === 0 }))}
            color={familyColor(c.family)}
            width={W - 380}
            height={ctx.step === 0 ? 520 : 330}
            format={fmtSeconds}
            max={max}
          />
        </PollSlide>
      )
    },
  },
  {
    id: 'poll-spotlight',
    title: 'Vote: Spotlight off',
    poll: 'spotlight',
    notes:
      'Any folder whose name ends in .noindex is skipped by Spotlight. Same Mac, same disk, only the folder name changes. Guess the speedup.',
    sources: poll('spotlight').sources,
    render: (ctx) => {
      const p = poll('spotlight') as NumberPoll
      return (
        <PollSlide p={p} ctx={ctx} index={4}>
          {ctx.step === 0 ? (
            <div className="hint">
              <code>~/worktrees/agent-1</code>
              <span>vs</span>
              <code>~/worktrees.noindex/agent-1</code>
            </div>
          ) : (
            <Bars
              items={MACS.map((id) => {
                const c = cfg(id)
                return { id, label: c.machineName, sub: c.stackName, value: setupTime(c, 16), color: familyColor(c.family) }
              })}
              width={W - 380}
              format={fmtSeconds}
            />
          )}
        </PollSlide>
      )
    },
  },
  {
    id: 'poll-same-pc',
    title: 'Vote: same PC, four setups (race)',
    poll: 'same-pc',
    notes: 'Same desktop, dual boot. Windows on NTFS with Defender, a Dev Drive, WSL2, and plain Linux.',
    sources: poll('same-pc').sources,
    render: (ctx) => {
      const p = poll('same-pc') as ChoicePoll
      const labels = Object.fromEntries(p.options.map((o) => [o.id, o.label]))
      return (
        <PollSlide p={p} ctx={ctx} index={5}>
          <Race configs={p.options.map((o) => cfg(o.id))} phases={['worktree_add', 'install']} width={W - 380} playing={ctx.step === 1} labels={labels} />
        </PollSlide>
      )
    },
  },
  {
    id: 'why-windows',
    title: 'Why: Windows',
    notes:
      'YOUR EXPLANATION. Points to verify: Defender real-time protection is a filter driver that inspects file opens and writes. Dev Drive = ReFS + Defender performance mode (asynchronous scanning), Microsoft\'s own answer to exactly this. WSL2 is a real Linux kernel with ext4 on a virtual disk: fast, as long as the files live inside it and not on /mnt/c.',
    render: () => (
      <div className="slide">
        <div className="kicker">Why</div>
        <h2>Where the time goes on Windows</h2>
        <div className="cards">
          <div className="card">
            <h3>A scanner on every write</h3>
            <p>Defender's real-time protection sits between every program and the disk, and looks at each new file.</p>
          </div>
          <div className="card">
            <h3>Dev Drive</h3>
            <p>ReFS plus Defender in performance mode: scans happen after the write, not in its way.</p>
          </div>
          <div className="card">
            <h3>WSL2</h3>
            <p>A real Linux kernel and ext4 in a virtual disk. Fast, as long as the repo lives inside it, not on /mnt/c.</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'git-race',
    title: 'Bonus: git itself breaks',
    notes:
      'Found while benchmarking. git worktree add reads the admin directories of other worktrees. If a sibling is half-created, it fails, with errno 0, hence the message "Success". Agent harnesses need to retry or serialize worktree creation.',
    sources: configs.map((c) => c.id),
    render: () => {
      const withRetries = configs
        .map((c) => ({ c, r: Object.values(c.retries).reduce((a, b) => a + b, 0) }))
        .filter((x) => x.r > 0)
        .sort((a, b) => b.r - a.r)
      return (
        <div className="slide">
          <div className="kicker">Bonus bug</div>
          <h2>Start 16 at once and git itself trips over</h2>
          <pre className="terminal">
            <span className="muted">$ git worktree add --detach wt/13</span>
            {'\n'}Preparing worktree (detached HEAD e91c705)
            {'\n'}
            <span className="error">fatal: failed to read .git/worktrees/11/commondir: Success</span>
          </pre>
          <p className="lead small">
            Creating a worktree reads every sibling's metadata. Catch one half-created and git gives up. The benchmark retries, like an agent harness
            should.
          </p>
          {withRetries.length > 0 && (
            <div className="retries">
              {withRetries.slice(0, 6).map(({ c, r }) => (
                <span className="chip" key={c.id}>
                  <i style={{ background: familyColor(c.family) }} />
                  {c.name}: {r} retries
                </span>
              ))}
            </div>
          )}
        </div>
      )
    },
  },
  {
    id: 'takeaways',
    title: 'What to do about it',
    notes: 'Adjust to what the final data shows. Each tip should point at a slide we just saw.',
    render: () => (
      <div className="slide">
        <div className="kicker">Takeaways</div>
        <h2>Running many agents? Pick your filesystem on purpose</h2>
        <ul className="tips">
          <li>
            <b>Reuse worktrees</b> instead of creating and deleting them. Deleting is often the slowest step.
          </li>
          <li>
            <b>Stagger agent starts</b> a little. Less contention, and git stops tripping over itself.
          </li>
          <li>
            <b>macOS:</b> keep worktrees in a folder ending in <code>.noindex</code>.
          </li>
          <li>
            <b>Windows:</b> a Dev Drive or WSL2, never node_modules on scanned NTFS.
          </li>
          <li>
            <b>Linux:</b> ext4 or xfs for the work directory, and the pnpm store on the same filesystem.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    notes: 'Announce the winner.',
    render: ({ state }) => <Leaderboard state={state} />,
  },
  {
    id: 'thanks',
    title: 'Thanks',
    notes: 'Repo link; it runs on macOS, Linux, Windows and WSL with one command.',
    render: () => (
      <div className="slide title-slide">
        <div>
          <div className="kicker">Thanks</div>
          <h1 className="hero">Run it yourself</h1>
          <pre className="terminal one-liner">curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash</pre>
          <p className="lead">{REPO_URL}</p>
        </div>
      </div>
    ),
  },
]

function fsBar(c: Config, value: number) {
  return { id: c.id, label: c.stackName, value, color: familyColor(c.family) }
}

function PollSlide({ p, ctx, index, children }: { p: ChoicePoll | NumberPoll; ctx: SlideCtx; index: number; children: ReactNode }) {
  const view = ctx.state?.polls[p.id]
  const revealed = ctx.step === 1
  return (
    <div className="slide poll-slide">
      <div className="kicker">
        Vote {index} of 5 {!revealed && <span className="live">· {view?.votes ?? 0} votes</span>}
      </div>
      <h2>{p.question}</h2>
      {p.kind === 'choice' && !revealed ? (
        <OptionGrid p={p} />
      ) : (
      <div className="poll-body">
        <div className="poll-main">{children}</div>
        <div className="poll-side">
          {p.kind === 'choice' ? (
            <ChoiceTally p={p} revealed={revealed} tally={view?.tally} />
          ) : revealed ? (
            <div className="answer">
              <div className="answer-label">Answer</div>
              <div className="answer-value">{p.unit === 's' ? fmtSeconds(p.answer) : fmtTimes(p.answer)}</div>
            </div>
          ) : (
            <div className="vote-cta">Guess on your device</div>
          )}
        </div>
      </div>
      )}
      {revealed && p.kind === 'number' && (
        <Guesses
          guesses={view?.guesses ?? []}
          answer={p.answer}
          min={p.min}
          max={p.max}
          width={W}
          format={(v) => (p.unit === 's' ? `${+v.toPrecision(2)} s` : `${+v.toPrecision(2)}×`)}
        />
      )}
    </div>
  )
}

function OptionGrid({ p }: { p: ChoicePoll }) {
  return (
    <ol className="option-grid">
      {p.options.map((o, i) => {
        const c = cfg(o.id)
        return (
          <li key={o.id}>
            <span className="letter">{String.fromCharCode(65 + i)}</span>
            <span className="option-text">
              <span className="option-label">{o.label}</span>
              <span className="option-detail">
                {c.stackName} · {c.machineDetail}
              </span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function ChoiceTally({ p, revealed, tally }: { p: ChoicePoll; revealed: boolean; tally?: Record<string, number> }) {
  const total = Object.values(tally ?? {}).reduce((a, b) => a + b, 0)
  return (
    <ol className="options">
      {p.options.map((o, i) => {
        const count = tally?.[o.id] ?? 0
        const correct = revealed && o.id === p.answer
        return (
          <li key={o.id} className={correct ? 'correct' : revealed ? 'wrong' : ''}>
            <span className="letter">{String.fromCharCode(65 + i)}</span>
            <span className="option-text">
              <span>{o.label}</span>
              {revealed && (
                <span className="option-tally tnum">
                  {count} {count === 1 ? 'vote' : 'votes'}
                  {total > 0 && ` · ${Math.round((100 * count) / total)}%`}
                </span>
              )}
            </span>
            {correct && <span className="check">✓</span>}
          </li>
        )
      })}
    </ol>
  )
}

function Leaderboard({ state }: { state: RoomState | null }) {
  const board = state?.leaderboard ?? []
  return (
    <div className="slide">
      <div className="kicker">Leaderboard</div>
      <h2>{board[0] ? `${board[0].name} wins` : 'No players yet'}</h2>
      <ol className="board">
        {board.map((row, i) => (
          <li key={i} className={i === 0 ? 'first' : ''}>
            <span className="rank tnum">{i + 1}</span>
            <span className="board-name">{row.name}</span>
            <span className="board-score tnum">{row.score.toLocaleString('en-US')}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function slideHasMock(s: SlideDef) {
  return (s.sources ?? []).some((id) => cfg(id).mock || (cfg(id).raceMock && s.id.startsWith('poll-')))
}


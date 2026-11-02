import type { ReactNode } from 'react'
import { type Config, cfg, configs, setupTime } from '../shared/data'
import { METRIC_LABEL, POLLS, type Poll, ZERO_AT, describeRatio, fmtRatio, metricValue, poll } from '../shared/polls'
import type { RoomState } from '../shared/protocol'
import { BlockText } from './blocks/BlockText'
import { SectorField } from './blocks/SectorField'
import { Guesses } from './charts/Guesses'
import { Race } from './charts/Race'
import { Scatter } from './charts/Scatter'
import { JoinCard } from './JoinCard'
import { INK, familyColor, fmtSeconds } from './theme'

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
  /** Full-bleed slides draw their own background. */
  bleed?: boolean
  /** Draws resource figures: badge when any source's resources are mock. */
  resources?: boolean
  render: (ctx: SlideCtx) => ReactNode
}

const REPO_URL = 'github.com/vilcht/fs-bench'
const W = 1408 // content width inside the slide padding

const RACE_LABELS: Record<string, string> = {
  'huawei:ext4': 'Laptop · Linux ext4',
  'huawei:home-btrfs': 'Laptop · Linux btrfs',
  'macbook:apfs': 'MacBook Air · macOS',
  'huawei-win:ntfs': 'Laptop · Windows',
}

const RACE = ['huawei:ext4', 'huawei:home-btrfs', 'macbook:apfs', 'huawei-win:ntfs']
// strace -f -c on one agent (lab/results/strace-*.txt).
const SYSCALLS: { step: string; total: string; parts: [string, string][] }[] = [
  { step: 'git worktree add', total: '97K', parts: [['12k', 'files written'], ['3.5k', 'folders created']] },
  { step: 'pnpm install', total: '202K', parts: [['53k', 'file links'], ['7.8k', 'folders created']] },
  { step: 'git worktree remove', total: '215K', parts: [['68k', 'files deleted'], ['10.7k', 'folders deleted']] },
]

const SCATTER: { id: string; label: string; sub?: string; anchor?: 'right' | 'left' | 'above' | 'below' | 'below-left' }[] = [
  { id: 'huawei:ext4', label: 'Linux ext4', sub: 'cheap and parallel', anchor: 'right' },
  { id: 'huawei:home-btrfs', label: 'Linux btrfs', sub: 'agents wait in line', anchor: 'below' },
  { id: 'macbook:apfs', label: 'macOS', sub: 'every file is expensive', anchor: 'right' },
  { id: 'huawei-win:ntfs', label: 'Windows', sub: 'both', anchor: 'below-left' },
]

// bpftrace profiles, 16 agents (lab/results/{ext4,btrfs}.txt): non-idle sleep during install, thread-seconds.
const BOTTLENECKS = [
  {
    fs: 'ext4',
    title: 'Updates in place, journals in batches',
    text: 'Agents mostly just wait for the folder they are writing into.',
    num: '1×',
    numSub: 'time spent waiting',
  },
  {
    fs: 'btrfs',
    title: 'Never overwrites: copies up one big tree',
    text: 'Every change goes through the top of the same tree, so all agents queue there.',
    num: '7×',
    numSub: 'time spent waiting',
  },
]

export const SLIDES: SlideDef[] = [
  {
    id: 'title',
    title: 'Title',
    bleed: true,
    notes:
      "Hi! Ten minutes on why the machine you run coding agents on matters more than you think. Join on your phone now: there's a game with points.",
    render: ({ state, joinUrl }) => (
      <div className="slide bleed">
        <SectorField title={'16 AGENTS\nONE SSD'} col={4} row={4} />
        <p className="title-sub">
          Every coding agent wants its own copy of the repo. What happens to your machine when sixteen of them start at once?
        </p>
        <JoinCard url={joinUrl} players={state?.players ?? 0} />
      </div>
    ),
  },
  {
    id: 'workflow',
    title: 'One agent, one worktree',
    notes:
      "Every agent gets its own copy of the repo, a git worktree, and runs pnpm install in it. Each square is a thousand files. Sixteen agents: over a million files created and deleted.",
    render: () => (
      <div className="slide">
        <h2>One agent = one worktree = one install</h2>
        <div className="flow">
          <code>git worktree add</code>
          <span className="flow-arrow">→</span>
          <code>pnpm install</code>
          <span className="flow-arrow">→</span>
          <code>agent works</code>
          <span className="flow-arrow">→</span>
          <code>git worktree remove</code>
        </div>
        <div className="towers-wrap">
          <div className="towers">
            {Array.from({ length: 16 }, (_, a) => (
              <div className="tower" key={a}>
                {Array.from({ length: 65 }, (_, k) => (
                  <i key={k} className={k >= 53 ? 'checkout' : undefined} />
                ))}
              </div>
            ))}
          </div>
          <div className="towers-legend">
            <p>
              <b>1 square = 1,000 files.</b> One agent: <i className="sq checkout" /> 12k checked out, <i className="sq" /> 53k in node_modules.
            </p>
            <p className="big-claim">
              Sixteen agents: <b>1.1 million files</b>, created and deleted.
            </p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'lineup',
    title: 'The lineup',
    notes:
      "One laptop, dual-booted: Linux and Windows. Same CPU, same SSD. Plus a MacBook Air M4. Same repo, same tools, offline installs, so the network doesn't matter.",
    render: () => {
      const machines = [...new Map(configs.map((c) => [c.machine, c])).values()]
      return (
        <div className="slide">
          <h2>One laptop, two operating systems. And a MacBook.</h2>
          <ul className="lineup">
            {machines.map((m) => (
              <li key={m.machine}>
                <span className="lineup-name">{m.machineName}</span>
                <span className="lineup-detail">{m.machineDetail}</span>
                <span className="lineup-stacks">
                  {configs
                    .filter((c) => c.machine === m.machine)
                    .map((c) => (
                      <span className="stack" key={c.id}>
                        <i style={{ background: familyColor(c.family) }} />
                        {c.stackName}
                      </span>
                    ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="footnote">
            Same repo, commit, Node and pnpm. Checkout → install → status → delete, with 1, 2, 4, 8 and 16 agents at once. Offline installs. Median of 3
            runs (Windows: 1 run, it took over an hour).
          </p>
        </div>
      )
    },
  },
  {
    id: 'how-to-play',
    title: 'How to play',
    notes:
      "You see one result, then guess how many times as long the next machine takes. 1x is the same, 3x is three times as long. Closest guess wins the most points.",
    sources: [POLLS[0].base],
    render: () => <HowToPlay />,
  },
  {
    id: 'round-macbook',
    title: 'Round: MacBook',
    poll: 'macbook',
    notes:
      "Base: the laptop on Linux, 22.7 s. The Mac has the faster CPU, about 3.5x. Reveal: one and a half times as long. On the faster chip.",
    sources: poll('macbook').sources,
    render: (ctx) => <RoundSlide p={poll('macbook')} ctx={ctx} />,
  },
  {
    id: 'round-spotlight',
    title: 'Round: Spotlight off',
    poll: 'spotlight',
    notes:
      "Everyone blames Spotlight indexing first. Folders ending in .noindex are skipped. Reveal: no difference. Not Spotlight.",
    sources: poll('spotlight').sources,
    render: (ctx) => <RoundSlide p={poll('spotlight')} ctx={ctx} />,
  },
  {
    id: 'round-windows',
    title: 'Round: Windows',
    poll: 'windows',
    notes:
      "Same laptop, booted into Windows, Defender on as it ships. Reveal: 17 times. Six and a half minutes on identical hardware.",
    sources: poll('windows').sources,
    render: (ctx) => <RoundSlide p={poll('windows')} ctx={ctx} />,
  },
  {
    id: 'round-ext4',
    title: 'Round: ext4',
    poll: 'ext4',
    notes:
      "Back to Linux. Fedora's default is btrfs; same laptop with ext4 instead. Reveal: four times faster, only the filesystem changed.",
    sources: poll('ext4').sources,
    render: (ctx) => <RoundSlide p={poll('ext4')} ctx={ctx} />,
  },
  {
    id: 'race',
    title: 'The full race',
    notes:
      "The recorded runs replayed on one time scale. Linux ext4 is done almost instantly; Windows is still going after six minutes.",
    sources: RACE,
    render: () => (
      <div className="slide">
        <h2>Sixteen agents, one replay</h2>
        <Race configs={RACE.map((id) => cfg(id))} phases={['worktree_add', 'install']} width={W} playing labels={RACE_LABELS} />
      </div>
    ),
  },
  {
    id: 'round-delete',
    title: 'Round: delete',
    poll: 'delete',
    notes:
      "Cleaning up: deleting the 16 worktrees. ext4 takes under 2 seconds. Reveal: the Mac takes 21 times as long, longer than creating them.",
    sources: poll('delete').sources,
    render: (ctx) => <RoundSlide p={poll('delete')} ctx={ctx} />,
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    notes:
      "Announce the winner. Then: so why?",
    render: ({ state }) => <Leaderboard state={state} />,
  },
  {
    id: 'syscalls',
    title: 'What an install really is',
    notes:
      "An install barely moves any data. It's hundreds of thousands of tiny requests to the operating system: create this folder, link this file. One agent: about 200 thousand for the install alone. Sixteen agents at once: millions, all at the same moment. That's why a faster SSD doesn't help: the work is bookkeeping, not data.",
    render: () => (
      <div className="slide">
        <h2>An install is not data. It's paperwork.</h2>
        <div className="calls">
          {SYSCALLS.map((c) => (
            <div className="call-card" key={c.step}>
              <code>{c.step}</code>
              <span className="call-total">
                <BlockText text={c.total} cell={12} />
                <small>requests to the OS</small>
              </span>
              <ul>
                {c.parts.map(([n, what]) => (
                  <li key={what}>
                    <b>{n}</b> {what}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="calls-total">
          16 agents at once: <b>millions of tiny requests</b>, all at the same moment. A faster SSD doesn't help.
        </p>
      </div>
    ),
  },
  {
    id: 'two-problems',
    title: 'Two different problems',
    notes:
      "Two separate problems. Left to right: how slow is it for ONE agent alone. Bottom to top: how much does running 16 at once help. The dashed line means no help at all: 16 at once take as long as 16 in a row. ext4: cheap and parallel. btrfs: cheap, but agents wait in line. The Mac: every file is expensive. Windows: both.",
    sources: SCATTER.map((s) => s.id),
    render: () => (
      <div className="slide">
        <h2>Two problems: every file is slow, or agents wait in line</h2>
        <Scatter
          points={SCATTER.map((s) => {
            const c = cfg(s.id)
            return { id: s.id, label: s.label, sub: s.sub, anchor: s.anchor, color: familyColor(c.family), x: setupTime(c, 1), y: (16 * setupTime(c, 1)) / setupTime(c, 16) }
          })}
          width={W}
          height={600}
          xTicks={[0.5, 1, 2, 5, 10, 30]}
          yTicks={[0, 1, 2, 3]}
          xLabel="one agent alone (seconds, log scale)"
          yLabel="how much 16 at once helps"
          xFormat={(v) => `${v} s`}
          yFormat={(v) => `${v}×`}
        />
      </div>
    ),
  },
  {
    id: 'linux-why',
    title: 'Linux: ext4 vs btrfs',
    notes:
      "Same laptop, same requests, so why is ext4 four times faster? It's how each one keeps its records. ext4 updates its records in place and writes its journal in big batches; agents only wait for the folder they're writing into. btrfs never overwrites anything: every change is written as a copy, all the way up one big tree. Every agent has to go through the top of that tree, so they queue. We measured it: btrfs agents spent seven times as long waiting.",
    render: () => (
      <div className="slide">
        <h2>Same requests, different bookkeeping</h2>
        <ul className="bottlenecks">
          {BOTTLENECKS.map((b) => (
            <li key={b.fs}>
              <span className="bn-fs">
                <i style={{ background: familyColor(b.fs) }} />
                {b.fs}
              </span>
              <span className="bn-what">
                <b>{b.title}</b>
                {b.text}
              </span>
              <span className="bn-num">
                {b.num}
                <small>{b.numSub}</small>
              </span>
            </li>
          ))}
        </ul>
        <p className="footnote">Measured by profiling the Linux kernel during the runs (bpftrace). Details in lab/ in the repo.</p>
      </div>
    ),
  },
  {
    id: 'why-macos',
    title: 'Why: macOS',
    notes:
      "On the Mac, every single file costs more: one agent alone is five times slower than Linux, on a faster CPU. Nearly all that time is inside the operating system, not in pnpm or git. APFS never overwrites its records either, and the pnpm team measured that it doesn't get faster with more threads. Spotlight wasn't it.",
    render: () => (
      <Why
        family="apfs"
        headline="macOS: every file costs more"
        causes={[
          ['5× slower, on a faster CPU', 'One agent alone: 4.5 s on the Mac, 0.9 s on Linux ext4.'],
          ['The time is inside macOS', '86% of install time and 99% of delete time is the operating system, not pnpm or git.'],
          ['Not Spotlight', 'Hiding the folder from Spotlight changed nothing.'],
        ]}
      />
    ),
  },
  {
    id: 'why-windows',
    title: 'Why: Windows',
    notes:
      "Windows is slow even with one agent: 27 seconds versus 1.4 on Linux, same laptop. The main toll is Defender: it checks every file the moment it's opened, before the program can continue. Microsoft's own Dev Drive changes that to check afterwards. We haven't measured Dev Drive yet.",
    render: () => (
      <Why
        family="ntfs"
        headline="Windows: a toll on every file"
        causes={[
          ['Slow even alone', 'One agent: 27 s on Windows, 1.4 s on Linux, same laptop.'],
          ['Every file gets checked', 'Defender scans each file when it is opened, and the program waits for it.'],
          ['Dev Drive: check later', "Microsoft's fix scans after the fact. Not measured here yet."],
        ]}
      />
    ),
  },
  {
    id: 'takeaways',
    title: 'What to do about it',
    notes:
      "Run fewer, reuse worktrees, and pick the filesystem on purpose.",
    render: () => (
      <div className="slide">
        <h2>Running many agents? Pick your filesystem on purpose.</h2>
        <ul className="tips">
          <li>
            <i style={{ background: INK.primary }} />
            <span>
              <b>More agents isn't free.</b> On btrfs and Windows, 16 at once finish no sooner than 16 in a row.
            </span>
          </li>
          <li>
            <i style={{ background: INK.primary }} />
            <span>
              <b>Reuse worktrees</b> instead of creating and deleting them. On the Mac, deleting took longer than creating.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('ext4') }} />
            <span>
              <b>Linux:</b> ext4 for agent work directories, pnpm store on the same filesystem. Same calls, 4× faster than btrfs.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('ntfs') }} />
            <span>
              <b>Windows:</b> keep repos off scanned NTFS: 17× slower than Linux on the same laptop. Try a Dev Drive or WSL2.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('apfs') }} />
            <span>
              <b>macOS:</b> keep pnpm's default (clones). Forcing hardlinks was 4–6× slower.
            </span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'thanks',
    title: 'Thanks',
    notes:
      "One command on macOS, Linux, Windows and WSL. Data and slides are in the repo. Thanks!",
    render: () => (
      <div className="slide thanks">
        <BlockText text={'RUN IT\nYOURSELF'} cell={22} />
        <pre className="terminal one-liner">curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash</pre>
        <p className="lead">{REPO_URL}</p>
      </div>
    ),
  },
]

function Why({ family, headline, causes }: { family: string; headline: string; causes: [string, string][] }) {
  return (
    <div className="slide why">
      <h2>{headline}</h2>
      <ul className="causes">
        {causes.map(([title, text], i) => (
          <li key={title}>
            <span className="cause-mark" style={{ background: familyColor(family) }}>
              <BlockText text={String(i + 1)} cell={9} color={INK.void} />
            </span>
            <span>
              <b>{title}</b>
              {text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function VoteCells({ votes }: { votes: number }) {
  return (
    <span className="vote-cells" aria-label={`${votes} votes`}>
      {Array.from({ length: Math.min(votes, 40) }, (_, i) => (
        <i key={i} className="fade-in" />
      ))}
      <span className="vote-count">{votes}</span>
    </span>
  )
}

function MachineCard({ c, value, hidden, tag }: { c: Config; value: number; hidden?: boolean; tag: string }) {
  return (
    <div className={hidden ? 'machine-card unknown' : 'machine-card'}>
      <span className="machine-tag">{tag}</span>
      <span className="machine-name">
        <i style={{ background: familyColor(c.family) }} />
        {c.machineName}
      </span>
      <span className="machine-stack">
        {c.stackName} · {c.machineDetail}
      </span>
      <span className="machine-value">
        <BlockText text={hidden ? '?' : fmtSeconds(value).replace(' ', '')} cell={15} />
      </span>
    </div>
  )
}

const SCALE_TICKS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 15, 20, 30]

/** The multiple axis everyone's slider uses: log scale, 1× in the middle of the meaning. */
function RatioScale({ min, max, width, example }: { min: number; max: number; width: number; example?: number }) {
  const pad = 40
  const height = 150
  const y = 70
  const x = (v: number) => pad + ((Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min))) * (width - 2 * pad)
  const ticks = SCALE_TICKS.filter((t) => t >= min && t <= max)
  return (
    <svg width={width} height={height} role="img" className="chart" aria-label={`Scale from ${min}× to ${max}×`}>
      <rect x={pad} y={y - 3} width={width - 2 * pad} height={6} fill={INK.axis} />
      <text x={pad} y={y - 26} className="chart-sub">
        ← faster
      </text>
      <text x={width - pad} y={y - 26} textAnchor="end" className="chart-sub">
        slower →
      </text>
      {ticks.map((t) => (
        <g key={t}>
          <rect x={x(t) - (t === 1 ? 5 : 3)} y={y - (t === 1 ? 18 : 12)} width={t === 1 ? 10 : 6} height={t === 1 ? 36 : 24} fill={t === 1 ? INK.primary : INK.secondary} />
          <text x={x(t)} y={y + 48} textAnchor="middle" className={t === 1 ? 'chart-value' : 'chart-tick'}>
            {t === 1 ? 'same' : fmtRatio(t)}
          </text>
        </g>
      ))}
      {example !== undefined && (
        <g>
          <rect x={x(example) - 14} y={y - 14} width={28} height={28} fill={INK.primary} stroke={INK.void} strokeWidth={4} />
          <text x={x(example)} y={y - 30} textAnchor="middle" className="chart-label small">
            your guess: {fmtRatio(example)}
          </text>
        </g>
      )}
    </svg>
  )
}

function RoundSlide({ p, ctx }: { p: Poll; ctx: SlideCtx }) {
  const view = ctx.state?.polls[p.id]
  const revealed = ctx.step === 1
  const index = POLLS.findIndex((x) => x.id === p.id) + 1
  const base = cfg(p.base)
  const target = cfg(p.target)
  return (
    <div className="slide round">
      <div className="poll-head">
        <span className="poll-tag">
          <BlockText text={`ROUND ${index}/${POLLS.length}`} cell={6} />
        </span>
        <span className="round-metric">{METRIC_LABEL[p.metric]}</span>
        {!revealed && <VoteCells votes={view?.votes ?? 0} />}
      </div>
      <h2>{p.prompt}</h2>
      <div className="faceoff">
        <MachineCard c={base} value={metricValue(base, p.metric)} tag="Known" />
        <div className="faceoff-x">
          <BlockText text={revealed ? `×${fmtRatio(p.answer).slice(0, -1)}` : '×?'} cell={revealed ? 8 : 12} />
          {revealed && <span className="faceoff-say fade-in">{describeRatio(p.answer)}</span>}
        </div>
        <MachineCard c={target} value={metricValue(target, p.metric)} hidden={!revealed} tag={revealed ? 'Revealed' : 'Your guess'} />
      </div>
      {revealed ? (
        <div className="round-reveal fade-in" key="reveal">
          <Guesses guesses={view?.guesses ?? []} answer={p.answer} min={p.min} max={p.max} width={W - 420} format={fmtRatio} />
          <ol className="closest">
            {(view?.closest ?? []).map((c, i) => (
              <li key={i}>
                <span className="rank">{i + 1}</span>
                <span className="board-name">{c.name}</span>
                <span className="closest-guess">{fmtRatio(c.value)}</span>
                <span className="closest-points">+{c.points}</span>
              </li>
            ))}
            {!view?.closest?.length && <li className="muted">No guesses</li>}
          </ol>
        </div>
      ) : (
        <div className="round-scale">
          <RatioScale min={p.min} max={p.max} width={W} />
        </div>
      )}
    </div>
  )
}

function HowToPlay() {
  const first = POLLS[0]
  const base = cfg(first.base)
  return (
    <div className="slide how">
      <h2>Higher or lower?</h2>
      <ol className="how-steps">
        <li>
          <b>You see one result.</b> First up: {base.name} gets 16 agents ready in {fmtSeconds(metricValue(base, first.metric))}.
        </li>
        <li>
          <b>Then the next machine.</b> How many times as long will it take?
        </li>
        <li>
          <b>Drag your slider.</b> 0.5× is twice as fast, 1× the same, 3× three times as long.
        </li>
      </ol>
      <RatioScale min={0.5} max={3} width={W} example={2} />
      <p className="footnote">
        Exact guess: 1000 points, down to 0 when you're {ZERO_AT}× off. The three closest get named on screen.
      </p>
    </div>
  )
}

function Leaderboard({ state }: { state: RoomState | null }) {
  const board = state?.leaderboard ?? []
  const [first, ...rest] = board
  return (
    <div className="slide leaderboard">
      <BlockText text="WINNER" cell={20} />
      {first ? (
        <>
          <div className="winner">
            <span className="winner-name">{first.name}</span>
            <span className="winner-score">{first.score.toLocaleString('en-US')}</span>
          </div>
          <ol className="board" start={2}>
            {rest.map((row, i) => (
              <li key={i}>
                <span className="rank">{i + 2}</span>
                <span className="board-name">{row.name}</span>
                <span className="board-score">{row.score.toLocaleString('en-US')}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="lead">No players yet.</p>
      )}
    </div>
  )
}

export function slideHasMock(s: SlideDef) {
  return (s.sources ?? []).some((id) => {
    const c = cfg(id)
    return c.mock || (s.id === 'race' && c.raceMock) || (s.resources && c.resourcesMock)
  })
}

import { Fragment, type ReactNode } from 'react'
import { type Config, type Resources, cfg, configs, phaseTime, setupTime } from '../shared/data'
import { METRIC_LABEL, POLLS, type Poll, ZERO_AT, describeRatio, fmtRatio, metricValue, poll } from '../shared/polls'
import type { RoomState } from '../shared/protocol'
import { BlockText } from './blocks/BlockText'
import { SectorField } from './blocks/SectorField'
import { Bars } from './charts/Bars'
import { Guesses } from './charts/Guesses'
import { Race } from './charts/Race'
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
const RESOURCE_ROWS = ['huawei:ext4', 'huawei:home-btrfs', 'huawei:xfs', 'macbook:apfs', 'huawei-win:ntfs']
const LINUX_FS = ['huawei:ext4', 'huawei:btrfs', 'huawei:home-btrfs', 'huawei:xfs']

export const SLIDES: SlideDef[] = [
  {
    id: 'title',
    title: 'Title',
    bleed: true,
    notes: 'Hi! 10 minutes on why the machine you run agents on matters more than you think. Join on your phone or laptop now: there are points to win.',
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
      'Each agent gets a git worktree so they do not step on each other. Each worktree needs its own node_modules. Every square here is a thousand files. Tiny files are exactly what filesystems are worst at.',
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
      'The main character is one Huawei laptop, dual-booted: Fedora Linux and Windows 11, same CPU, same SSD. Against it, a MacBook Air M4, also a 16 GB laptop. Same l2beat commit, same Node and pnpm everywhere, offline installs from a warm store, so the network is out of the picture. 1, 2, 4, 8 and 16 agents at once. Linux and Mac: median of 3 runs. Windows: 1 run, it took over an hour.',
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
    notes: 'Explain the slider once: we show one result, then the next machine. Guess how many times as long it takes. 1x same, 0.5x twice as fast, 3x three times as long. Closest guesses get the most points; 2.5x off gets nothing.',
    sources: [POLLS[0].base],
    render: () => <HowToPlay />,
  },
  {
    id: 'round-macbook',
    title: 'Round: MacBook',
    poll: 'macbook',
    notes:
      'Base: the Huawei laptop on Fedora, its default btrfs home. The MacBook Air has the faster CPU: about 3x faster on our CPU-only baseline. Most people guess the Mac wins.',
    sources: poll('macbook').sources,
    render: (ctx) => <RoundSlide p={poll('macbook')} ctx={ctx} />,
  },
  {
    id: 'round-spotlight',
    title: 'Round: Spotlight off',
    poll: 'spotlight',
    notes:
      'Any folder whose name ends in .noindex is skipped by Spotlight. Same Mac, same disk, only the folder name changes. Reveal: no difference. Spotlight is not the culprit. (Honest caveat: the .noindex pass ran second, on a fanless Air that had warmed up; its CPU baseline got about 30% slower. Even so, nothing points at Spotlight.)',
    sources: poll('spotlight').sources,
    render: (ctx) => <RoundSlide p={poll('spotlight')} ctx={ctx} />,
  },
  {
    id: 'why-macos',
    title: 'Why: macOS',
    notes:
      'YOUR EXPLANATION. Data: kernel share of the benchmark processes\' CPU time was 86-91% during install and 98-99% during delete, versus 1% for the CPU-only baseline. Points to verify before presenting: (1) APFS metadata is copy-on-write B-trees, so each create/delete rewrites tree nodes rather than updating in place. (2) Per-call kernel overhead: an install is hundreds of thousands of small file system calls. Forcing pnpm to hardlink instead of clone made it 4-6x slower still.',
    render: () => (
      <Why
        family="apfs"
        headline="Where the time goes on a Mac"
        causes={[
          ['Inside the kernel, not Spotlight', '86% of the install CPU time and 99% of the delete CPU time is the kernel. Hiding the folder from Spotlight changed nothing.'],
          ['Copy-on-write metadata', 'APFS never updates metadata in place. Every file created or deleted rewrites parts of its B-trees.'],
          ['Small calls, many of them', 'An install is a storm of tiny open, mkdir, clone and stat calls. Per-call overhead decides the result.'],
        ]}
      />
    ),
  },
  {
    id: 'round-windows',
    title: 'Round: Windows',
    poll: 'windows',
    notes:
      'The same Huawei laptop, dual boot: Fedora vs Windows 11, NTFS with Defender real-time protection on, as it ships. Same CPU, same SSD. Expect people to guess 2-3x; the slider goes to 30x for a reason.',
    sources: poll('windows').sources,
    render: (ctx) => <RoundSlide p={poll('windows')} ctx={ctx} />,
  },
  {
    id: 'why-windows',
    title: 'Why: Windows',
    notes:
      "YOUR EXPLANATION. Data: one measured run (the full run took over an hour, so it was stopped early). 16 installs moved 31 GB through the disk on Windows vs 1.5 GB on Linux ext4 on the same laptop (Windows figure from the warmup rep: the resource sampler stopped before the measured rep). Points to verify: Defender real-time protection is a filter driver that inspects file opens and writes. Dev Drive = ReFS + Defender performance mode (asynchronous scanning). WSL2 = real Linux kernel with ext4 on a virtual disk, fast as long as the files live inside it, not on /mnt/c. Dev Drive and WSL2 were NOT measured: the Dev Drive check failed with access denied.",
    render: () => (
      <Why
        family="ntfs"
        headline="Where the time goes on Windows"
        causes={[
          ['A scanner on every write', "Defender's real-time protection sits between every program and the disk, and looks at each new file. 53k per install."],
          ['31 GB through the disk', 'Same laptop, same 16 installs: 31 GB read and written on Windows, 1.5 GB on Linux with ext4.'],
          ['Next to measure', "Microsoft's own fixes: a Dev Drive (ReFS, scanning out of the way) or WSL2 (Linux ext4 in a virtual disk)."],
        ]}
      />
    ),
  },
  {
    id: 'round-ext4',
    title: 'Round: ext4',
    poll: 'ext4',
    notes: 'Back to Linux. Fedora installs btrfs by default. Same laptop, same kernel, the work directory on an ext4 volume instead.',
    sources: poll('ext4').sources,
    render: (ctx) => <RoundSlide p={poll('ext4')} ctx={ctx} />,
  },
  {
    id: 'linux-fs',
    title: 'Same laptop, four filesystems',
    notes:
      'Linux is not magic either: only ext4 keeps up. btrfs is copy-on-write like APFS (the home one also compresses with zstd). xfs is the surprise: slowest to install, with the CPU mostly idle (25% busy), so it is waiting rather than working. Deleting: ext4 under 2 s, everything else about 15 s.',
    sources: LINUX_FS,
    render: () => (
      <div className="slide">
        <h2>Same laptop, same kernel. Only the filesystem changes.</h2>
        <div className="two-col">
          <div>
            <h3 className="chart-title">16 agents: checkout + install</h3>
            <Bars items={LINUX_FS.map((id) => fsBar(cfg(id), setupTime(cfg(id), 16)))} width={680} labelWidth={150} format={fmtSeconds} />
          </div>
          <div>
            <h3 className="chart-title">16 agents: delete worktrees</h3>
            <Bars items={LINUX_FS.map((id) => fsBar(cfg(id), phaseTime(cfg(id), 'remove', 16)))} width={680} labelWidth={150} format={fmtSeconds} />
          </div>
        </div>
        <p className="footnote">btrfs is copy-on-write, like APFS. "home" is Fedora's default btrfs, with zstd compression.</p>
      </div>
    ),
  },
  {
    id: 'race',
    title: 'The full race',
    notes:
      'Replay of the recorded runs, 16 agents each, all on one time scale. Every row is one agent; faint = checkout, solid = install. Linux ext4 is done before you can see it. Windows takes six and a half minutes.',
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
    notes: 'Deleting is the step nobody thinks about. Base: the laptop on ext4, deleting 16 worktrees in under 2 seconds.',
    sources: poll('delete').sources,
    render: (ctx) => <RoundSlide p={poll('delete')} ctx={ctx} />,
  },
  {
    id: 'resources',
    title: 'What the machine was doing',
    notes:
      "Install phase, 16 agents at once. CPU busy is machine-wide; kernel share is how much of the benchmark processes' CPU time went to the OS rather than git or pnpm. High kernel share = filesystem work inside the OS. Windows: no kernel split (Git Bash cannot see native process times), and its figures come from the warmup run because the sampler stopped before the measured one.",
    sources: RESOURCE_ROWS,
    resources: true,
    render: () => <ResourceGrid />,
  },
  {
    id: 'git-race',
    title: 'Bonus: git breaks',
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
          <h2>Start 16 at once and git itself trips over</h2>
          <pre className="terminal">
            <span className="term-dim">$ git worktree add --detach wt/13</span>
            {'\n'}Preparing worktree (detached HEAD e91c705)
            {'\n'}
            <span className="term-err">fatal: failed to read .git/worktrees/11/commondir: Success</span>
          </pre>
          <p className="lead">
            Creating a worktree reads every sibling's metadata. Catch one half-created and git gives up, reporting "Success". The benchmark retries, like an
            agent harness should.
          </p>
          {withRetries.length > 0 && (
            <ul className="retries">
              {withRetries.slice(0, 6).map(({ c, r }) => (
                <li key={c.id}>
                  <span className="retry-cells">
                    {Array.from({ length: Math.min(r, 24) }, (_, k) => (
                      <i key={k} style={{ background: familyColor(c.family) }} />
                    ))}
                  </span>
                  <span>
                    {c.name} <b>{r}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )
    },
  },
  {
    id: 'takeaways',
    title: 'What to do about it',
    notes: 'Each tip points at a slide we just saw.',
    render: () => (
      <div className="slide">
        <h2>Running many agents? Pick your filesystem on purpose.</h2>
        <ul className="tips">
          <li>
            <i style={{ background: INK.primary }} />
            <span>
              <b>Reuse worktrees</b> instead of creating and deleting them. On the Mac, deleting 16 took longer than creating them.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('ntfs') }} />
            <span>
              <b>Windows:</b> keep repos off scanned NTFS. 17× slower than Linux on the same laptop. Try a Dev Drive or WSL2.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('ext4') }} />
            <span>
              <b>Linux:</b> ext4 for the work directory, with the pnpm store on the same filesystem. 4× faster than Fedora's default btrfs.
            </span>
          </li>
          <li>
            <i style={{ background: familyColor('apfs') }} />
            <span>
              <b>macOS:</b> keep pnpm's default import method (clones). Forcing hardlinks was 4–6× slower.
            </span>
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
      <div className="slide thanks">
        <BlockText text={'RUN IT\nYOURSELF'} cell={22} />
        <pre className="terminal one-liner">curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash</pre>
        <p className="lead">{REPO_URL}</p>
      </div>
    ),
  },
]

function fsBar(c: Config, value: number) {
  return { id: c.id, label: c.stackName, value, color: familyColor(c.family) }
}

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

const RESOURCE_COLS: { key: keyof Resources; label: string; sub: string; format: (v: number) => string; max?: number }[] = [
  { key: 'busy_pct', label: 'CPU busy', sub: 'all cores', format: (v) => `${Math.round(v)}%`, max: 100 },
  { key: 'kernel_pct', label: 'Kernel share', sub: 'of the CPU time', format: (v) => `${Math.round(v)}%`, max: 100 },
  { key: 'mem_mb', label: 'Extra RAM', sub: 'peak', format: (v) => (v >= 1000 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`) },
  { key: 'disk_mb', label: 'Disk traffic', sub: 'read + written', format: (v) => (v >= 1000 ? `${(v / 1024).toFixed(1)} GB` : `${Math.round(v)} MB`) },
]
const RES_CELLS = 12

function ResourceGrid() {
  const rows = RESOURCE_ROWS.map((id) => cfg(id))
  const max = Object.fromEntries(
    RESOURCE_COLS.map((col) => [col.key, col.max ?? Math.max(1, ...rows.map((c) => c.resources.install?.[col.key] ?? 0))]),
  )
  return (
    <div className="slide">
      <h2>16 installs at once: what the machine was doing</h2>
      <div className="res-grid">
        <span />
        {RESOURCE_COLS.map((col) => (
          <span className="res-head" key={col.key}>
            {col.label}
            <small>{col.sub}</small>
          </span>
        ))}
        {rows.map((c) => (
          <Fragment key={c.id}>
            <span className="res-name">
              <i style={{ background: familyColor(c.family) }} />
              <span>
                {c.machineName}
                <small>{c.stackName}</small>
              </span>
            </span>
            {RESOURCE_COLS.map((col) => {
              const v = c.resources.install?.[col.key]
              const filled = v === undefined ? 0 : Math.max(1, Math.round((v / max[col.key]) * RES_CELLS))
              return (
                <span className="res-cell" key={col.key}>
                  <span className="res-cells">
                    {Array.from({ length: RES_CELLS }, (_, k) => (
                      <i key={k} style={k < filled ? { background: familyColor(c.family) } : undefined} />
                    ))}
                  </span>
                  <span className="res-value">{v === undefined ? 'n/a' : col.format(v)}</span>
                </span>
              )
            })}
          </Fragment>
        ))}
      </div>
      {rows.some((c) => c.resourcesFromWarmup) && (
        <p className="footnote">
          Windows: no kernel split (Git Bash can't see native process times); CPU, RAM and disk from the warmup run.
        </p>
      )}
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

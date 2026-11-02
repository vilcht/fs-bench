import { Fragment, type ReactNode } from 'react'
import { type Config, cfg, configs, setupTime } from '../shared/data'
import { METRIC_LABEL, POLLS, type Poll, ZERO_AT, describeRatio, fmtRatio, metricValue, poll } from '../shared/polls'
import type { RoomState } from '../shared/protocol'
import { BlockText } from './blocks/BlockText'
import { SectorField } from './blocks/SectorField'
import { Bars } from './charts/Bars'
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
  /** Target speaking time, from SCRIPT.md. */
  seconds?: number
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

// lab/machine_load.py: machine-wide CPU while 16 agents create, install and delete (whole computer, incl. the OS
// and Defender). busyFor = seconds of the whole computer at 100%.
const LOAD: { id: string; label: string; busyFor: number; wall: number; avg: number; peak: number }[] = [
  { id: 'huawei:ext4', label: 'Linux ext4', busyFor: 4.5, wall: 6.9, avg: 65, peak: 93 },
  { id: 'huawei:home-btrfs', label: 'Linux btrfs', busyFor: 13.8, wall: 38, avg: 36, peak: 87 },
  { id: 'macbook:apfs', label: 'MacBook', busyFor: 52.7, wall: 77.5, avg: 68, peak: 100 },
  { id: 'huawei-win:ntfs', label: 'Windows', busyFor: 233, wall: 463, avg: 50, peak: 89 },
]

const ERAS: [string, string][] = [
  ['Files are precious: protect every one', 'node_modules is disposable: regenerated in seconds'],
  ['One person, one task at a time', '16 agents, ~950 threads at once'],
  ['Files change now and then', 'Millions of tiny files created and deleted per hour'],
]

export const SLIDES: SlideDef[] = [
  {
    id: 'title',
    title: 'Title',
    bleed: true,
    notes:
      "\"Ten minutes on why the machine you run coding agents on matters more than you think. Scan the code, there's a game with points.\"",
    seconds: 25,
    render: ({ state, joinUrl }) => (
      <div className="slide bleed">
        <SectorField title={'ON\nWORKTREES'} col={4} row={4} />
        <p className="title-sub">
          <span className="title-and">and filesystems</span>
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
      "\"Every agent gets its own copy of the repo and runs pnpm install in it. Each square is a thousand files. Sixteen agents: over a million files created and deleted.\"",
    seconds: 25,
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
      "\"One laptop, dual-booted Linux and Windows: same CPU, same SSD. Plus a MacBook Air. Same repo, same tools, offline installs.\"",
    seconds: 15,
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
      "\"You see one result, then guess how many times as long the next one takes. Closest guess, most points.\"",
    seconds: 15,
    sources: [POLLS[0].base],
    render: () => <HowToPlay />,
  },
  {
    id: 'round-macbook',
    title: 'Round: MacBook',
    poll: 'macbook',
    notes:
      "\"Linux on the laptop: 22.7 seconds. The Mac has a CPU three and a half times faster\u2026\" Reveal: \"One and a half times slower.\"",
    seconds: 35,
    sources: poll('macbook').sources,
    render: (ctx) => <RoundSlide p={poll('macbook')} ctx={ctx} />,
  },
  {
    id: 'round-spotlight',
    title: 'Round: Spotlight off',
    poll: 'spotlight',
    notes:
      "\"Everyone blames Spotlight. Same Mac, folder Spotlight skips.\" Reveal: \"No difference.\"",
    seconds: 25,
    sources: poll('spotlight').sources,
    render: (ctx) => <RoundSlide p={poll('spotlight')} ctx={ctx} />,
  },
  {
    id: 'round-windows',
    title: 'Round: Windows',
    poll: 'windows',
    notes:
      "\"Same laptop, booted into Windows.\" Reveal: \"Seventeen times. Six and a half minutes, identical hardware.\"",
    seconds: 35,
    sources: poll('windows').sources,
    render: (ctx) => <RoundSlide p={poll('windows')} ctx={ctx} />,
  },
  {
    id: 'round-ext4',
    title: 'Round: ext4',
    poll: 'ext4',
    notes:
      "\"Linux again, but ext4 instead of Fedora's default btrfs.\" Reveal: \"Four times faster. Only the filesystem changed.\"",
    seconds: 25,
    sources: poll('ext4').sources,
    render: (ctx) => <RoundSlide p={poll('ext4')} ctx={ctx} />,
  },
  {
    id: 'race',
    title: 'The full race',
    notes:
      "\"All of them on one clock. ext4 is done before you can see it. Windows is still going.\"",
    seconds: 25,
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
      "\"Cleaning up. ext4 deletes everything in under two seconds.\" Reveal: \"The Mac: 21 times as long.\"",
    seconds: 25,
    sources: poll('delete').sources,
    render: (ctx) => <RoundSlide p={poll('delete')} ctx={ctx} />,
  },
  {
    id: 'leaderboard',
    title: 'Leaderboard',
    notes:
      "\"And the winner is\u2026 So, why?\"",
    seconds: 15,
    render: ({ state }) => <Leaderboard state={state} />,
  },
  {
    id: 'syscalls',
    title: 'What an install really is',
    notes:
      "\"An install barely moves any data. It's hundreds of thousands of tiny requests to the operating system: make this folder, link this file. Sixteen agents: millions at once. A faster SSD doesn't help.\"",
    seconds: 30,
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
      "\"Two separate problems. Left to right: how slow is one agent alone. Bottom to top: does running sixteen at once help. ext4 is cheap and parallel. btrfs is cheap, but agents wait in line. On the Mac every file is expensive. Windows has both.\"",
    seconds: 40,
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
    id: 'cpu-load',
    title: 'Does it slow down your computer?',
    notes:
      "\"Does this make your computer sluggish? Yes. While sixteen agents set up and clean up, half to all of your CPU is busy. On the Mac it hits 100%: every core. Add it up and Windows keeps the whole laptop busy for about four minutes, ext4 for four seconds. And three quarters or more of that is the operating system doing file bookkeeping, not pnpm or git.\"",
    seconds: 35,
    sources: LOAD.map((l) => l.id),
    render: () => (
      <div className="slide">
        <h2>Does it slow down your computer? Yes.</h2>
        <h3 className="chart-title">16 agents create, install and delete: the whole computer at 100% for…</h3>
        <Bars
          items={LOAD.map((l) => ({
            id: l.id,
            label: l.label,
            sub: `${l.avg}% busy for ${l.wall >= 100 ? `${Math.round(l.wall / 60)} min` : `${Math.round(l.wall)} s`}, peak ${l.peak}%`,
            value: l.busyFor,
            color: familyColor(cfg(l.id).family),
          }))}
          width={W}
          labelWidth={330}
          format={(v) => (v >= 100 ? `${(v / 60).toFixed(1)} min` : `${v.toFixed(v < 10 ? 1 : 0)} s`)}
        />
        <p className="calls-total load-note">
          <b>Three quarters or more of it is the operating system</b> doing file bookkeeping, not pnpm or git.
        </p>
        <p className="footnote">Machine-wide CPU from the benchmark's sampler. Windows: warmup run. We measured load, not how laggy the UI felt.</p>
      </div>
    ),
  },
  {
    id: 'linux-why',
    title: 'Why btrfs looked like the future',
    notes:
      "\"For years btrfs was 'the future' and ext4 the old workhorse. In 2008 ext4's own maintainer called it a bridge to btrfs, and Fedora made btrfs the default in 2020. The idea: never overwrite anything, write every change as a new copy up one big tree. That gives you free snapshots, checksums that catch a dying disk, compression, instant copies. ext4 just updates its records in place: boring. But 'never overwrite' means every tiny change rewrites its path to the top of that one tree, and every agent has to pass through the top. With one user you never notice. With sixteen agents they queue: seven times more waiting.\"",
    seconds: 50,
    render: () => (
      <Tradeoff
        headline="Why btrfs looked like the future"
        rows={[
          {
            fs: 'ext4',
            family: 'ext4',
            era: '1993 → 2008',
            built: ['Update records in place', 'Journal for crash safety'],
            gives: ['Simple, predictable', 'No snapshots, no data checksums'],
            costs: ['Agents mostly wait just for their own folder', '1× waiting'],
          },
          {
            fs: 'btrfs',
            family: 'btrfs',
            era: '2007 → Fedora default 2020',
            built: ['Never overwrite: copy every change up one big tree'],
            gives: ['Free snapshots', 'Checksums catch a dying disk', 'Compression, instant copies'],
            costs: ['Every tiny change rewrites its path to the top', 'All agents queue at the root: 7× waiting'],
          },
        ]}
        footnote="In 2008, ext4's maintainer described ext4 as a bridge to btrfs. Waiting: kernel profiles of 16 agents (lab/)."
      />
    ),
  },
  {
    id: 'why-macos',
    title: 'Why APFS is built this way',
    notes:
      "\"APFS replaced a filesystem from 1998, and it shipped on the iPhone first, in 2017. Apple built it for flash storage, with encryption as a primary feature. Like btrfs it never overwrites its records: that buys crash safety, instant clones, snapshots for Time Machine and system updates. Perfect for a phone: one person, one app, precious photos. Agents are the opposite. Every create and delete rewrites tree nodes, and it doesn't get faster with more threads: five times slower per file than Linux, on a faster CPU.\"",
    seconds: 45,
    render: () => (
      <Tradeoff
        headline="Why APFS is built this way"
        rows={[
          {
            fs: 'APFS',
            family: 'apfs',
            era: '2016, iPhone first',
            built: ['Flash storage, encryption first', 'Never overwrite records (copy-on-write)'],
            gives: ['Crash safety without a journal', 'Instant clones and snapshots', 'Per-file encryption'],
            costs: ['Every create and delete rewrites tree nodes', "Doesn't speed up with more threads", '5× slower per file, 86–99% inside macOS'],
          },
        ]}
        footnote="Apple, WWDC 2016: 'optimized for Flash/SSD storage, engineered with encryption as a primary feature'. Thread scaling: pnpm team's measurements."
      />
    ),
  },
  {
    id: 'why-windows',
    title: 'Why Windows checks every file',
    notes:
      "\"On Windows it's not really the filesystem. After twenty years of malware, every Windows since 8 ships with Defender, and it sits in front of the disk: every file is checked when it's opened, and the program waits. Invisible for normal use, it stops a lot of attacks. A developer opening millions of files pays it millions of times. Microsoft knows: Dev Drive, from 2023, checks code folders later instead of first. We haven't measured it yet.\"",
    seconds: 40,
    render: () => (
      <Tradeoff
        headline="Why Windows checks every file"
        rows={[
          {
            fs: 'NTFS + Defender',
            family: 'ntfs',
            era: '1993 + the malware era',
            built: ['Antivirus in every Windows (since 8)', 'A filter in front of the disk'],
            gives: ['Every file checked before a program uses it', 'Safe by default, no setup'],
            costs: ['Every open waits for a scan', 'One agent alone: 27 s vs 1.4 s on Linux', 'Dev Drive (2023): check later instead'],
          },
        ]}
        footnote="Same laptop, same SSD. Defender real-time protection on, as shipped. Dev Drive not measured yet."
      />
    ),
  },
  {
    id: 'different-job',
    title: 'Built for a different job',
    notes:
      "\"None of these are bad filesystems. They were built for a different job: files are precious, one person does one thing at a time, files change now and then. Agents break all three. node_modules is disposable, sixteen agents run around 950 threads, and they churn through millions of tiny files. We pay for snapshots, checksums, encryption and virus scans on files we delete an hour later.\"",
    seconds: 35,
    render: () => (
      <div className="slide">
        <h2>Built for a different job</h2>
        <ul className="eras">
          {ERAS.map(([then, now]) => (
            <li key={then}>
              <span className="era-then">{then}</span>
              <span className="era-arrow">→</span>
              <span className="era-now">{now}</span>
            </li>
          ))}
        </ul>
        <p className="calls-total">
          We pay for <b>snapshots, checksums, encryption and virus scans</b> on files we delete an hour later.
        </p>
      </div>
    ),
  },
  {
    id: 'takeaways',
    title: 'What to do about it',
    notes:
      "\"More agents isn't free: on btrfs and Windows, sixteen at once take as long as sixteen in a row. Reuse worktrees. On Linux, use ext4 for agent work. On Windows, get off scanned NTFS. On the Mac, keep pnpm's defaults.\"",
    seconds: 30,
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
      "\"One command, any OS. Thanks!\"",
    seconds: 10,
    render: () => (
      <div className="slide thanks">
        <BlockText text={'RUN IT\nYOURSELF'} cell={22} />
        <pre className="terminal one-liner">curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash</pre>
        <p className="lead">{REPO_URL}</p>
      </div>
    ),
  },
]

interface TradeoffRow {
  fs: string
  family: string
  era: string
  built: string[]
  gives: string[]
  costs: string[]
}

/** Design → benefit → what agents pay, one row per filesystem. */
function Tradeoff({ headline, rows, footnote }: { headline: string; rows: TradeoffRow[]; footnote?: string }) {
  return (
    <div className={rows.length === 1 ? 'slide tradeoff single' : 'slide tradeoff'}>
      <h2>{headline}</h2>
      <div className="to-grid">
        <span />
        <span className="to-head">Built for</span>
        <span className="to-head">Gives you</span>
        <span className="to-head to-cost">What agents pay</span>
        {rows.map((r) => (
          <Fragment key={r.fs}>
            <span className="to-fs">
              <span>
                <i style={{ background: familyColor(r.family) }} />
                {r.fs}
              </span>
              <small>{r.era}</small>
            </span>
            {[r.built, r.gives, r.costs].map((items, k) => (
              <ul key={k} className={k === 2 ? 'to-cell to-cost' : 'to-cell'}>
                {items.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            ))}
          </Fragment>
        ))}
      </div>
      {footnote && <p className="footnote">{footnote}</p>}
    </div>
  )
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

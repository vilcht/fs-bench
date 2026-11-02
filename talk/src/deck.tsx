import type { ReactNode } from 'react'
import { type Config, cfg, configs, phaseTime, setupTime } from '../shared/data'
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
const LINUX_FS = ['huawei:ext4', 'huawei:btrfs', 'huawei:home-btrfs', 'huawei:xfs']

// strace -f -c on one agent (lab/results/strace-*.txt).
const SYSCALLS: { step: string; total: string; parts: [string, string][] }[] = [
  { step: 'git worktree add', total: '97K', parts: [['12k', 'files written'], ['27k', 'opens'], ['3.5k', 'directories']] },
  { step: 'pnpm install', total: '202K', parts: [['53k', 'hardlinks'], ['7.8k', 'directories'], ['3.7k', 'symlinks']] },
  { step: 'git worktree remove', total: '215K', parts: [['68k', 'unlinks'], ['10.7k', 'directories removed'], ['79k', 'stats']] },
]

const SCATTER: { id: string; label: string; sub?: string; anchor?: 'right' | 'left' | 'above' | 'below' | 'below-left' }[] = [
  { id: 'huawei:ext4', label: 'Linux ext4', sub: 'cheap and parallel', anchor: 'right' },
  { id: 'huawei:btrfs', label: 'btrfs', anchor: 'above' },
  { id: 'huawei:home-btrfs', label: 'btrfs (home)', anchor: 'right' },
  { id: 'huawei:xfs', label: 'xfs', sub: 'cheap, but queue', anchor: 'below' },
  { id: 'macbook:apfs', label: 'macOS APFS', sub: 'expensive per file', anchor: 'right' },
  { id: 'huawei-win:ntfs', label: 'Windows NTFS', sub: 'expensive and queue', anchor: 'below-left' },
]

// bpftrace profiles, 16 agents (lab/results/{ext4,xfs,btrfs}.txt).
const BOTTLENECKS = [
  {
    fs: 'ext4',
    title: 'Per-directory locks, batched journal',
    text: 'Threads mostly wait for the directory they write into. The journal folds thousands of changes into one commit.',
    num: '1.2k',
    numSub: 'thread-seconds asleep (install)',
  },
  {
    fs: 'xfs',
    title: 'One journal, one reservation lock',
    text: 'Every link reserves log space up front, under a single global lock. Half of all waiting is right there.',
    num: '11.6k',
    numSub: 'thread-seconds asleep (install)',
  },
  {
    fs: 'btrfs',
    title: 'One B-tree, one root',
    text: 'All files live in one copy-on-write tree. Every unlink locks its root; deleting is two thirds spinning on it.',
    num: '8.0k',
    numSub: 'thread-seconds asleep (install)',
  },
]

// Profiled lab runs on fresh 48 GB volumes (lab/results/*.txt).
const XFS_PROOF = [
  { id: 'xfs', label: 'xfs default', family: 'xfs', install: 21.48, remove: 15.67 },
  { id: 'xfs-biglog', label: 'xfs, 1 GB log', family: 'xfs', install: 21.91, remove: 7.94 },
  { id: 'xfs-noparent', label: 'xfs, no parent ptrs', family: 'xfs', install: 16.77, remove: 6.28 },
  { id: 'ext4', label: 'ext4', family: 'ext4', install: 3.3, remove: 1.49 },
]

const MYTHS: ['no' | 'partly' | 'yes', string, string][] = [
  ['no', '"It\'s the SSD."', 'Same laptop, same SSD: Windows takes 17× as long as Linux. The Mac has the faster SSD.'],
  ['no', '"Spotlight is indexing everything."', 'A folder Spotlight skips (.noindex): no difference.'],
  ['no', '"ext4 can\'t hardlink, so pnpm copies."', 'It can, and pnpm 12 prefers hardlinks on Linux. Copies mean the store is on another filesystem.'],
  ['partly', '"syspolicyd checks every process."', 'Real, but it costs at process start (postinstall scripts). Our installs ran no scripts.'],
  ['no', '"Just run more agents."', 'On btrfs, xfs and NTFS, 16 at once finish no sooner than 16 in a row.'],
]

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
    id: 'round-windows',
    title: 'Round: Windows',
    poll: 'windows',
    notes:
      'The same Huawei laptop, dual boot: Fedora vs Windows 11, NTFS with Defender real-time protection on, as it ships. Same CPU, same SSD. Expect people to guess 2-3x; the slider goes to 30x for a reason.',
    sources: poll('windows').sources,
    render: (ctx) => <RoundSlide p={poll('windows')} ctx={ctx} />,
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
    id: 'leaderboard',
    title: 'Leaderboard',
    notes: 'Announce the winner.',
    render: ({ state }) => <Leaderboard state={state} />,
  },
  {
    id: 'syscalls',
    title: 'What one agent asks for',
    notes:
      'Under the hood. Measured with strace on one agent: checkout is 97 thousand system calls, install 202 thousand (53 thousand of them are hardlinks), delete 215 thousand. Times 16 agents: over 8 million calls, and pnpm 12 runs its installer as a native binary with about 59 threads per install, so roughly 950 threads hit the filesystem at the same moment. Almost none of this is reading or writing data: it is metadata. Creating names, linking, unlinking.',
    render: () => (
      <div className="slide">
        <h2>What one agent asks the kernel to do</h2>
        <div className="calls">
          {SYSCALLS.map((c) => (
            <div className="call-card" key={c.step}>
              <code>{c.step}</code>
              <span className="call-total">
                <BlockText text={c.total} cell={12} />
                <small>system calls</small>
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
          × 16 agents: <b>8 million system calls</b>, from about <b>950 threads</b> at once. Nearly all metadata, almost no data.
        </p>
        <p className="footnote">strace -f -c on one agent (Linux). pnpm 12 installs with a native binary: ~59 threads per install.</p>
      </div>
    ),
  },
  {
    id: 'two-problems',
    title: 'Two different problems',
    notes:
      'This is the key chart. Two separate questions. Left to right: how expensive is the work for ONE agent, alone on the machine. Bottom to top: when 16 run at once, how much faster is that than running them one after another. The CPU-only baseline gets about 2.5 to 3x on every machine, so the hardware can do parallel work. ext4 is cheap AND parallel. btrfs and xfs are cheap per file but do not parallelize at all: 16 agents take as long as 16 in a row. They queue. The Mac is expensive per file, five times ext4 on a faster CPU, but does scale somewhat. Windows is expensive per file even alone, 27 seconds for one agent, and also does not parallelize.',
    sources: SCATTER.map((s) => s.id),
    render: () => (
      <div className="slide">
        <h2>Two different problems: cost per file, and queueing</h2>
        <Scatter
          points={SCATTER.map((s) => {
            const c = cfg(s.id)
            return { id: s.id, label: s.label, sub: s.sub, anchor: s.anchor, color: familyColor(c.family), x: setupTime(c, 1), y: (16 * setupTime(c, 1)) / setupTime(c, 16) }
          })}
          width={W}
          height={600}
          xTicks={[0.5, 1, 2, 5, 10, 30]}
          yTicks={[0, 1, 2, 3, 4]}
          xLabel="one agent alone: checkout + install (seconds, log scale)"
          yLabel="speedup from running 16 at once"
          xFormat={(v) => `${v} s`}
          yFormat={(v) => `${v}×`}
        />
      </div>
    ),
  },
  {
    id: 'linux-why',
    title: 'Linux: where the agents queue',
    notes:
      'On Linux we can look inside. I profiled the kernel during the runs with bpftrace: what every thread was doing on the CPU, and where it went to sleep. pnpm made exactly the same calls on all three: hardlinks, mkdir, symlink. The difference is where they queue. ext4: only per-directory locks, and its journal batches many changes into one commit, so nothing global. xfs: every link starts a journal transaction and must reserve log space, under one global lock, the grant head. Half of all waiting during install is right there. btrfs: everything in a subvolume lives in one B-tree. Every unlink locks the root of that tree exclusively; during delete, two thirds of the kernel time is threads spinning on that one lock.',
    render: () => (
      <div className="slide">
        <h2>Linux: same calls, different place to queue</h2>
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
        <p className="footnote">bpftrace on-CPU and off-CPU kernel stacks, 16 agents, Fedora 44, kernel 7.2. Details: lab/ in the repo.</p>
      </div>
    ),
  },
  {
    id: 'xfs-proof',
    title: 'Proof: turn one knob',
    notes:
      'If the journal is the bottleneck, changing the journal should change the result. It does. A 1 GB log instead of 64 MB: deleting gets twice as fast, because it was waiting for log space. Install does not move: it is not the space, it is the single lock everyone takes to reserve it; with the bigger log, threads stop sleeping and spin on that lock instead (three quarters of kernel time). Turning off parent pointers, a new xfs feature that adds an extended attribute on every link, makes install 22% faster and delete 60% faster. ext4 for reference.',
    render: () => (
      <div className="slide">
        <h2>Proof: change the journal, change the result</h2>
        <div className="two-col">
          <div>
            <h3 className="chart-title">16 installs</h3>
            <Bars items={XFS_PROOF.map((r) => ({ id: r.id, label: r.label, value: r.install, color: familyColor(r.family) }))} width={680} labelWidth={250} format={fmtSeconds} />
          </div>
          <div>
            <h3 className="chart-title">16 deletes</h3>
            <Bars items={XFS_PROOF.map((r) => ({ id: r.id, label: r.label, value: r.remove, color: familyColor(r.family) }))} width={680} labelWidth={250} format={fmtSeconds} />
          </div>
        </div>
        <p className="footnote">Separate profiled runs on fresh 48 GB volumes (lab/), so ext4/xfs differ slightly from the main results.</p>
      </div>
    ),
  },
  {
    id: 'why-macos',
    title: 'Why: macOS',
    notes:
      "We can't profile the Mac's kernel the same way, so here is what we measured plus what others measured. One agent alone already costs five times ext4, on a CPU that is three and a half times faster. Almost all of it is kernel time: 86% during install, 99% during delete; 16 deletes burn 195 CPU-seconds where ext4 needs 24. The pnpm team measured that APFS serializes metadata writes across the whole volume: clonefile stays around 6 thousand per second whether you use 1 or 32 threads, and hardlinks get slower with more threads. That is why pnpm clones on the Mac, and why forcing hardlinks was 4 to 6 times slower for us. Caveat to say out loud: an Apple engineer has said blocked time can show up as kernel time, so part of that 99% may be waiting, not working. Linux in a VM on the same Apple chip is several times faster, so it is not the hardware. And Spotlight changed nothing.",
    render: () => (
      <Why
        family="apfs"
        headline="macOS: every file costs more"
        causes={[
          ['5× the cost, on a faster CPU', 'One agent alone: 4.5 s vs 0.9 s on Linux ext4. The M4 is 3.5× faster on the CPU-only baseline.'],
          ['Almost all kernel', '86% of install and 99% of delete CPU time is in the kernel. 16 deletes: 195 CPU-seconds, vs 24 on ext4.'],
          ['One volume, one queue', "pnpm's team measured APFS metadata writes not scaling with threads; hardlinks get slower. Spotlight: no effect."],
        ]}
      />
    ),
  },
  {
    id: 'why-windows',
    title: 'Why: Windows',
    notes:
      "Windows is slow even with one agent: 27 seconds alone versus 1.4 on Linux on the same laptop. So this is per-file cost first, queueing second. The big per-file toll is Defender real-time protection: a filter driver sits in front of the filesystem and scans synchronously when files are opened and closed. Microsoft's own wording for the normal mode is 'open now, scan now'; Dev Drive's performance mode is 'open now, scan later'. Second: NTFS stores every hard link as another name record inside the target file's 1 KB MFT record, and 16 agents link the same store files. Third, an open question: 16 installs wrote 27 GB to disk. Copying every package would be only 8 GB, and pnpm hardlinks on NTFS, so this is metadata and journaling we have not pinned down. Caveats: one measured run, and we did not get Dev Drive or WSL2 measured.",
    render: () => (
      <Why
        family="ntfs"
        headline="Windows: a toll on every file"
        causes={[
          ['Slow even alone', 'One agent: 27 s, vs 1.4 s on Linux on the same laptop. Per-file cost first, queueing second.'],
          ['Scanned on every open', 'Defender real-time protection scans synchronously: "open now, scan now". Dev Drive: "open now, scan later".'],
          ['27 GB written', 'For 16 installs. Copying every package would be 8 GB, and pnpm hardlinks here. NTFS metadata and logging? Open question.'],
        ]}
      />
    ),
  },
  {
    id: 'myths',
    title: 'Things you may have heard',
    notes:
      "Quick myth check, because this topic is all over YouTube right now, Theo has two videos on it. 'It's the SSD': the Mac's SSD is faster, and Linux vs Windows on the same SSD is 17x. 'Spotlight indexing': the .noindex run changed nothing. 'ext4 can't hardlink, so pnpm copies': wrong, ext4 hardlinks fine, and pnpm 12 even prefers hardlinks over clones on Linux; if you see copies, your store is on another filesystem. 'syspolicyd': real, but it costs at process start, so it hits postinstall scripts; our installs ran no scripts and were still slow. 'Just add more agents': on btrfs, xfs and NTFS, 16 agents finish no sooner than 16 in a row.",
    render: () => (
      <div className="slide">
        <h2>Things you may have heard</h2>
        <ul className="myths">
          {MYTHS.map(([verdict, claim, fact]) => (
            <li key={claim} className={`myth ${verdict}`}>
              <span className="myth-verdict">{verdict === 'no' ? '✗' : verdict === 'partly' ? '~' : '✓'}</span>
              <span>
                <b>{claim}</b>
                {fact}
              </span>
            </li>
          ))}
        </ul>
      </div>
    ),
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
              <b>More agents isn't free.</b> On btrfs, xfs and NTFS, 16 at once finish no sooner than 16 in a row: they queue inside the kernel.
            </span>
          </li>
          <li>
            <i style={{ background: INK.primary }} />
            <span>
              <b>Reuse worktrees</b> instead of creating and deleting them. Deleting is metadata work too, and on the Mac it took longer than creating.
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

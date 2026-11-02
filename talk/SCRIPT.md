# Talk script: 16 agents, one SSD

Full spoken script for the deck, slide by slide, with the technical background behind every claim. The `/notes`
view shows a short version of the same notes; this file is the long version to rehearse from.

- **Full talk:** about 15 minutes (game ≈ 8 min, under the hood ≈ 6 min, wrap-up ≈ 1 min).
- **10-minute cut:** skip slides 16 (proof), 19 (myths) and 20 (git breaks), and keep slides 14–18 to one or two
  sentences each. Rounds take about 30 s each.
- **Each slide has:** **Say** (what to say, in plain words), **Deeper** (if someone asks, or if you have time)
  and **Evidence** (where the number comes from). Everything quoted on a slide is measured unless it says otherwise.

Numbers: one Huawei laptop (Intel Core Ultra 5 125H, 16 GB, WD SN740 SSD), dual-booted Fedora 44 (kernel 7.2) and
Windows 11; and a MacBook Air M4 (16 GB, macOS 27). Same l2beat commit, Node 22.22.3, pnpm 12.3.4, offline installs
from a warm store. "Setup" = `git worktree add` + `pnpm install`; "16 agents" = 16 at the same moment.

---

## Part 1: the game

### 1. Title (30 s)

**Say:** "Hi. Ten minutes — fifteen if you let me — on why the machine you run coding agents on matters more than you
think. Scan the QR code or open the link: there's a game, and there are points."

Wait until the player count stops climbing.

### 2. One agent, one worktree (45 s)

**Say:** "Every coding agent wants its own copy of the repo, so it doesn't trample the others. With git, that's a
worktree. A worktree is useless without `node_modules`, so each agent also runs an install. When it's done, we delete
the worktree. Each square here is a thousand files: twelve thousand checked out, fifty-three thousand in
`node_modules`. Sixteen agents: over a million files created and deleted. Tiny files are exactly what filesystems
are worst at."

**Deeper:** pnpm doesn't copy packages into each `node_modules`. It keeps one content-addressed store and *links*
each file into the project, so an install is mostly metadata: directory entries, links and symlinks, almost no data.

**Evidence:** `find` on one installed worktree: 64,961 files, 10,707 directories, 3,431 symlinks; 52,952 of
the files are hard links into the store.

### 3. The lineup (40 s)

**Say:** "The main character is one laptop, dual-booted: Fedora Linux and Windows 11. Same CPU, same SSD, same RAM.
Against it, a MacBook Air M4, also 16 GB. Same repo, same commit, same Node and pnpm everywhere, installs offline
from a warm store, so the network is out of the picture. Linux and Mac are medians of three runs; Windows is one
run, because the full run took over an hour."

### 4. How to play (40 s)

**Say:** "We show you one result. Then the next machine. You guess how many times as long it takes: one means the
same, a half means twice as fast, three means three times as long. Exact guess, a thousand points; two and a half
times off, zero."

### 5. Round 1: MacBook Air (40 s)

**Say:** "Base: the laptop on Fedora, its default btrfs home, gets 16 agents ready in 22.7 seconds. The MacBook has
the faster CPU, about three and a half times faster on our CPU-only test. How long does the Mac take?"

*Reveal (1.5×, 34.6 s):* "One and a half times as long, on the faster chip. Hold that thought."

### 6. Round 2: Spotlight off (40 s)

**Say:** "Everyone's first suspect on a Mac is Spotlight indexing all these new files. Folders ending in `.noindex`
are skipped by Spotlight. Same Mac, same disk, only the folder name changes."

*Reveal (1.0×):* "Nothing. Spotlight is not the problem."

**Deeper:** Spotlight indexes asynchronously, after the files exist, so it was never on the critical path. Honest
caveat: the `.noindex` pass ran second, on a fanless Air that had warmed up (its CPU baseline with 16 processes went
from 3.7 s to 4.9 s). Even so, nothing points at Spotlight.

### 7. Round 3: Windows (45 s)

**Say:** "Same laptop. Same CPU, same SSD. Booted into Windows 11: NTFS, with Defender real-time protection on, as
it ships. Base is Linux at 22.7 seconds. The slider goes to thirty for a reason."

*Reveal (17×, 393 s):* "Seventeen times. Six and a half minutes, on identical hardware. We'll come back to why."

### 8. Round 4: ext4 (40 s)

**Say:** "Back to Linux. Fedora installs btrfs by default. Same laptop, same kernel, same pnpm, the work directory on
ext4 instead."

*Reveal (0.23×, 5.2 s):* "Four times faster, by changing nothing but the filesystem."

### 9. Same laptop, four filesystems (40 s)

**Say:** "Here's the whole Linux picture. ext4: five seconds to set up, under two to delete. btrfs, on a fresh volume
or as Fedora's default home: 18 to 23 seconds, 15 to delete. xfs, which has a reputation as the fast server
filesystem: slowest of the four."

**Deeper:** "home" is Fedora's default btrfs with zstd compression; the others are fresh 48 GB volumes on the same
SSD (loop images with direct I/O). More on xfs in a minute; it's the most interesting one.

### 10. The race (45 s)

**Say:** "A replay of the recorded runs, all on one time scale. Every row is one agent; faint is checkout, solid is
install. Linux ext4 is done before you can see it. The Mac takes 35 seconds. Windows is still going."

### 11. Round 5: delete (40 s)

**Say:** "The step nobody thinks about: cleaning up. Base: the laptop on ext4 deletes 16 worktrees in 1.8 seconds.
How long does the Mac take?"

*Reveal (21×, 38 s):* "Twenty-one times. On the Mac, deleting took longer than creating."

### 12. Leaderboard (20 s)

**Say:** "And the winner is…" Then: "Now, why."

---

## Part 2: under the hood

### 13. What one agent asks the kernel to do (60 s)

**Say:** "I counted every system call one agent makes. Checkout: 97 thousand. Install: 202 thousand, and 53 thousand
of those are hard links. Delete: 215 thousand, 68 thousand of them unlinks. Times sixteen agents: over eight million
system calls. And pnpm 12 runs its installer as a native binary with about 59 threads per install, so roughly 950
threads hit the filesystem at the same moment. Almost none of this is reading or writing data. It's metadata:
creating names, linking, unlinking. That's why a faster SSD doesn't save you."

**Deeper:**
- A *hard link* is a second name for the same file (same inode). Creating one writes a directory entry and bumps
  the file's link count; deleting one does the reverse. No file data moves.
- Every such change must be crash-safe, so the filesystem records it in a journal or a copy-on-write tree.
  That bookkeeping is where filesystems differ.
- Sixteen installs link the *same* store files at the same time, so they also contend on the same inodes.

**Evidence:** `strace -f -c` on one agent (`lab/results/strace-*.txt`); pnpm's thread names (`pnpm-native`,
37× `pacquet-startup`, 21× `tokio-rt-worker`) read from `/proc` during an install.

### 14. Two different problems (75 s) — the key slide

**Say:** "There are two separate questions. Left to right: how expensive is the work for *one* agent, alone on the
machine. Bottom to top: when sixteen run at once, how much faster is that than running them one after another.
Below the dashed line, there's no benefit at all. The hardware can do parallel work: our CPU-only test gets 16 jobs
done in under three times the time of one, on every machine. ext4: cheap and parallel. btrfs and xfs: cheap per
file, but zero speedup. Sixteen agents take as long as sixteen in a row: they queue. The Mac: five times the cost per
file, but it does scale a bit. Windows: expensive per file even alone, 27 seconds for one agent, and no speedup
either."

**Deeper:** speedup = 16 × (time for 1 agent) ÷ (time for 16 agents). Setup speedups: ext4 2.7×, btrfs 1.0–1.2×,
xfs 0.9×, APFS 2.1×, Windows 1.1×. Delete speedups: ext4 3.6×, btrfs 0.8×, xfs 0.7×, APFS 1.6×.

**Evidence:** computed live from `shared/data/results.json` (n = 1 and n = 16 medians).

### 15. Linux: same calls, different place to queue (90 s)

**Say:** "On Linux we can look inside the kernel while it happens. I profiled every thread with bpftrace: what it was
doing on the CPU, and where it went to sleep. pnpm made exactly the same calls on all three filesystems. The
difference is where the threads queue.

ext4: threads mostly wait for the directory they're writing into, and its journal folds thousands of changes into
one commit. Nothing global.

xfs: every link starts a journal transaction and must reserve space in the log first, and that reservation goes
through one global lock. Half of all the waiting during install is right there.

btrfs: every file in a volume lives in one copy-on-write B-tree. Changes go through the root of that tree, and
during delete, two thirds of the kernel's time is threads spinning on that one lock."

**Deeper:**
- **Thread-seconds asleep** (install, excluding idle thread pools): ext4 1,200, btrfs 8,000, xfs 11,600.
- **ext4.** jbd2 batches all updates into one running transaction (committed every 5 s or when full), so a block
  changed a thousand times is logged once. Inode tables are preallocated; directories use a hashed index (htree);
  metadata is updated in place. The main wait is the VFS's own per-directory lock (`filename_create → down_write`,
  75% of install waiting), plus the shared store inode in `vfs_link` (10%). Delete barely sleeps (1.3
  thread-seconds); it's CPU in `ext4_unlink`/`ext4_evict_inode` and the journal.
- **xfs.** Each operation is a transaction that must *reserve* its worst-case log space up front
  (`xfs_log_reserve`). The accounting is the log's "grant head", protected by one spinlock. Install: 53% of
  waiting is `xlog_grant_head_wait` (37% from `xfs_link`, 8% from `xfs_attr_set`, which is parent pointers, see
  slide 16). Delete: 71% of waiting is the same reservation, from `xfs_remove`.
- **btrfs.** All inodes, directory items and back-references of a subvolume live in one B-tree. Updates are
  copy-on-write: a modified leaf is written elsewhere, so its parent must change too, up to the root. Install:
  56% of waiting is metadata *space reservation tickets* (`handle_reserve_ticket`), and the spinning is on the
  global block-reservation lock. Delete: 64% of kernel samples hold `btrfs_lock_root_node`, 53% are optimistic
  spinning (`osq_lock`). Chris Mason measured this root-lock contention back in 2016 (9k creates/s on btrfs vs 33k
  on xfs). It has improved since, but not gone.
- These are *Linux kernel* behaviours. They're about the filesystem's design under ~950 concurrent writers, not
  bugs in pnpm or git.

**Evidence:** `lab/results/{ext4,xfs,btrfs}.txt` (bpftrace on-CPU at 499 Hz and off-CPU sleep time by kernel stack,
per phase, 16 agents on fresh 48 GB volumes). Profiling overhead was negligible (ext4 install 3.30 s profiled vs 3.39
s unprofiled).

### 16. Proof: change the journal, change the result (45 s) — skip in the 10-minute cut

**Say:** "If the journal really is the bottleneck, changing the journal should change the result. It does. A 1 GB log
instead of 64 MB: deleting gets twice as fast; it was waiting for log space. Install doesn't move: it's not the
space, it's the single lock everyone takes to reserve it. With the bigger log, threads stop sleeping and spin on that
lock instead: three quarters of the kernel's time. And xfs has a new feature called parent pointers, an extra
attribute written on every link. Turn it off: install 22% faster, delete 60% faster."

**Deeper:**
- Default log on a 48 GB volume: 16,384 × 4 KiB = 64 MiB. mkfs.xfs's own source notes that the 64 MiB floor was chosen
  to cut long-tail waits on the grant head.
- Parent pointers (`parent=1`, the current mkfs default) store each name → parent link as an xattr on the inode, so
  `link`, `unlink` and `create` each also do an attribute update in the same transaction.
- The no-parent-pointer volume also got a larger default log (113 MiB), so that comparison is slightly confounded.
- Not advice to reformat your xfs: parent pointers exist for online repair. It's evidence for the mechanism.

**Evidence:** `lab/results/xfs-biglog.txt` and `xfs-noparent.txt`. Spinlock callers in the big-log run: 33%
`xlog_grant_head_check`, 33% `xfs_log_space_wake`, 32% `xlog_grant_head_wait`.

### 17. macOS: every file costs more (75 s)

**Say:** "We can't profile the Mac's kernel the same way, so here's what we measured, plus what others measured. One
agent alone already costs five times ext4, on a CPU that's three and a half times faster. Almost all of it is
kernel time: 86% during install, 99% during delete. Sixteen deletes burn 195 CPU-seconds; ext4 needs 24. The pnpm team
measured that APFS doesn't scale metadata writes with threads: cloning stays around six thousand files a second
whether you use one thread or thirty-two, and hard links get slower with more threads. That's why pnpm clones on the
Mac, and why forcing hard links made our installs four to six times slower. And it's not the hardware: Linux in a VM
on the same Apple chip is several times faster."

**Deeper:**
- APFS writes all metadata copy-on-write: the filesystem tree and the object map are never modified in place, so
  every create or delete rewrites tree nodes (Apple File System Reference).
- **Clones** (`clonefile`) get a new inode that shares data extents with the original, with reference counts in an
  extent-reference tree. Deleting a cloned file has to check and decrement those counts.
- **Hard links** on APFS are not just a second directory entry: they add sibling-link and sibling-map records to
  the inode. That's consistent with forced hard links being 4–6× slower than clones.
- Caveat: an Apple engineer has said some "system time" in such measurements is threads *blocked* in the kernel.
  So part of the 99% may be waiting on locks, not working. Either way it's time inside the kernel, not in pnpm or git.
- Others' data points (not ours): on the NullVoxPopuli benchmark, HFS+ on a RAM disk under macOS was no faster than
  APFS on the SSD, and one machine got much faster with System Integrity Protection disabled. Both suggest that
  macOS layers above the on-disk format matter too (VFS, security policy). We didn't test either.

**Evidence:** `results/apple-m4-macos-apfs-*` (kernel %, CPU-seconds); pnpm PR #14248 (APFS scaling);
Apple File System Reference; Apple Developer Forums thread 800906 (accounting caveat).

### 18. Windows: a toll on every file (75 s)

**Say:** "Windows is slow even with a single agent: 27 seconds alone, versus 1.4 on Linux on the same laptop. So it's
per-file cost first, queueing second. The biggest per-file toll is Defender real-time protection: a filter driver
sits in front of the filesystem and scans files synchronously when they're opened. Microsoft's own description of
the normal mode is 'open now, scan now'. Dev Drive's performance mode is 'open now, scan later'. Then NTFS itself:
every hard link is another name record inside the target file's 1 KB record in the master file table, and sixteen
agents link the same store files. And one open question: sixteen installs wrote 27 GB to disk. Copying every package
would only be 8 GB, and pnpm hard links on NTFS. So that's metadata and logging we haven't pinned down yet."

**Deeper:**
- The `git worktree add` of 16 checkouts took 51–70 s (warmup and measured run; vs 1.9 s on ext4). That's the same per-file create/close cost
  plus scanning; git is a single process here, so process-spawn overhead isn't the main cost.
- The 27 GB comes from the warmup run (the sampler stopped before the measured one); the warmup's install took
  307 s vs 323 s measured, so it's the same workload.
- pnpm 12 on Windows tries clone first (fails on NTFS), then hard links; it copies only if the store is on another
  volume or a file hits NTFS's 1,023-link limit. The 27 GB is not explained by copying (store = 536 MB).
- Candidates for the 27 GB, all unverified: MFT records growing attribute lists as link names pile up, the NTFS
  `$LogFile` and USN change journal, directory index (`$I30`) rewrites. Checking it needs Windows-side tracing
  (e.g. Process Monitor or `wpr`), which we haven't done.
- Caveats: one measured run; machine-wide figures come from the warmup run because the resource sampler stopped
  early; Git Bash can't see native process CPU times, so there's no kernel split; Dev Drive and WSL2 were not
  measured (the Dev Drive check failed with "access denied").

**Evidence:** `results/ntfs-NTFS-20261102-081619` (+ its README); Microsoft Defender "performance mode" docs;
NTFS hard-link and MFT docs; pnpm 12 `link_file.rs`.

### 19. Things you may have heard (45 s) — optional

**Say:** "Quick myth check, because this is all over YouTube right now; Theo has two videos on it.
'It's the SSD': no. Same SSD, Windows takes 17 times as long as Linux, and the Mac has the faster SSD.
'Spotlight': no difference.
'ext4 can't hard link, so pnpm copies': wrong. ext4 hard links fine, and pnpm 12 even prefers hard links on
Linux. If you see copies, your store is on another filesystem.
'syspolicyd checks every process': real, but it costs when a process starts, so it hits postinstall scripts. Our
installs ran no scripts and were still slow.
'Just run more agents': on btrfs, xfs and NTFS, sixteen at once finish no sooner than sixteen in a row."

**Deeper:** see Appendix C for each of Theo's claims, checked against our data.

### 20. Start 16 at once and git itself trips over (30 s) — optional

**Say:** "A bonus bug. `git worktree add` reads every other worktree's metadata. Catch one half-created and git gives
up, with the error message 'Success', because the error code was zero. Agent harnesses should retry or serialize
worktree creation."

### 21. What to do about it (45 s)

**Say:**
- "More agents isn't free. On btrfs, xfs and NTFS, sixteen at once finish no sooner than sixteen in a row.
  They queue inside the kernel.
- Reuse worktrees instead of creating and deleting them. On the Mac, deleting took longer than creating.
- Linux: put agent work directories on ext4, with the pnpm store on the same filesystem. Same calls, four
  times faster than btrfs.
- Windows: keep repos off scanned NTFS. Try a Dev Drive or WSL2. We haven't measured those yet.
- macOS: keep pnpm's default, which clones. Forcing hard links was four to six times slower."

### 22. Run it yourself (15 s)

**Say:** "It's one command on macOS, Linux, Windows and WSL. The repo has the data, the profiling scripts, and this
deck. Thanks!"

---

## Appendix A: glossary

- **System call (syscall):** a request from a program to the kernel: open, link, unlink, mkdir, stat…
- **Inode:** the filesystem's record for one file (size, permissions, where the data is). Names point to inodes.
- **Hard link:** another name for the same inode. Cheap in principle: one directory entry, link count + 1.
- **Clone / reflink:** a new inode that *shares* the original's data blocks until either is modified
  (copy-on-write). APFS `clonefile`, btrfs/xfs `FICLONE`.
- **Journal (log):** a write-ahead record of metadata changes so a crash can't leave the filesystem half-updated.
  ext4 uses jbd2; xfs has its own log.
- **Copy-on-write (CoW) tree:** instead of updating metadata in place, write a modified copy elsewhere and update
  the parent to point at it, up to the root. APFS and btrfs work this way.
- **VFS:** the kernel layer shared by all Linux filesystems: path lookup, directory locks (`i_rwsem`), the dentry
  cache.
- **Sleeping lock vs spinlock:** a thread waiting on a sleeping lock gives the CPU away (shows as *off-CPU*); a
  thread waiting on a spinlock burns CPU in a loop (shows as *kernel time*).
- **On-CPU / off-CPU profile:** sampling what threads execute vs recording where (and how long) they sleep.

## Appendix B: how we measured, and what to be careful about

- **Benchmark:** `fsbench.sh`, 1/2/4/8/16 agents, 3 measured reps + 1 warmup (Windows: 1 + 1). Per phase: wall time,
  user/kernel CPU of the processes, machine-wide CPU/RAM/disk from `sampler.pl` (`sampler.ps1` on Windows).
- **Syscall census:** `strace -f -c` on one agent's worktree add, install and remove (Linux, btrfs home).
- **Kernel profiles:** `lab/profile.sh` — a fresh 48 GB loop volume, a warmup round, then a profiled round with one
  bpftrace session per phase (`lab/prof.bt`): kernel stacks sampled at 499 Hz for git and pnpm's installer
  threads, plus off-CPU time summed by the kernel stack where each thread went to sleep. `lab/stacks.py` summarizes.
  Idle thread-pool waits (futex, epoll) are excluded from "asleep".
- **Same calls on every Linux filesystem:** pnpm 12 reported "Packages are hard linked" on ext4, xfs and btrfs
  (its Linux default is hardlink → clone → copy). On the Mac it reported "cloned".
- **Caveats:**
  - Windows is one run, with machine-wide figures from the warmup. Its delete used a different procedure and is
    not on any slide.
  - The Mac's kernel can't be profiled with these tools. The Mac explanation combines our measurements with
    published ones.
  - The xfs/btrfs profiles explain where time goes under this workload (~950 threads, hard-link heavy). They don't
    make those filesystems bad in general.
  - Lab timings are from separate runs and differ slightly from the main results; the slides say which is which.

## Appendix C: Theo's videos, checked against our data

Theo (t3.gg) covered this in "Why I'm moving to Linux (for real)" (2026-07-03) and "MacOS Is Making Your Mac
Slow" (2026-08-20), mostly using NullVoxPopuli's `disk-perf-git-and-pnpm` benchmark plus his own worktree timings.
His numbers line up with ours (Mac ≈ 35 s vs Linux in single-digit seconds). His explanations, checked:

- **"It's the file system, not the hardware."** Consistent with our data: same-laptop Linux vs Windows 17×, and
  Linux in a VM on Apple silicon is fast. Can't tell the APFS format apart from the macOS layers above it.
- **"Parallel barely helps on APFS."** Partly. Our Mac gets 2.1× from 16-way parallelism vs 2.7× on ext4; btrfs,
  xfs and NTFS are worse (≈ 1×).
- **"APFS hard links have big overhead."** Consistent: forcing hard links on our Mac was 4–6× slower than
  clones, and APFS stores hard links with extra sibling records.
- **"syspolicyd tracks every process."** Plausible for process-heavy work (postinstall scripts, sub-agents).
  It doesn't explain our results: our installs ran no scripts (`--ignore-scripts`), and git's checkout/delete is
  one process per agent.
- **"ext4 doesn't do linking, so it had to copy."** Wrong. ext4 supports hard links, and pnpm used them in every
  ext4 run. What ext4 lacks is *clones* (reflinks). Copies happen when the store is on another filesystem.
- **XFS + VDO "clones without cloning."** Misleading. VDO is block-level dedup/compression underneath the
  filesystem: it saves space after the fact, but it isn't instant clones (xfs reflink is). And in our runs, plain
  xfs was the *slowest* Linux option for this workload.

## Appendix D: sources

- Apple File System Reference — https://developer.apple.com/support/downloads/Apple-File-System-Reference.pdf
- pnpm 12 import order (`AUTO_FIRST_TIER`), NTFS fallbacks — https://github.com/pnpm/pnpm/blob/main/pnpm/crates/deps-restorer/src/link_file.rs
- pnpm PR #14248, APFS metadata scaling measurements — https://github.com/pnpm/pnpm/pull/14248
- Apple Developer Forums on kernel-time accounting — https://developer.apple.com/forums/thread/800906
- Gregory Szorc, "Global kernel locks in APFS" (2018, disputed) — https://gregoryszorc.com/blog/2018/10/29/global-kernel-locks-in-apfs/
- Gregory Szorc, "Surprisingly slow" (Windows file close and process costs) — https://gregoryszorc.com/blog/2021/04/06/surprisingly-slow/
- Microsoft Defender performance mode ("open now, scan later") — https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-endpoint-antivirus-performance-mode
- Dev Drive — https://learn.microsoft.com/en-us/windows/dev-drive/
- ext4 admin guide — https://docs.kernel.org/admin-guide/ext4.html
- btrfs on-disk format — https://btrfs.readthedocs.io/en/latest/dev/On-disk-format.html
- btrfs root-lock contention (Chris Mason, LWN 2016) — https://lwn.net/Articles/698090/
- xfsprogs mkfs defaults (log size, AG count) — https://git.kernel.org/pub/scm/fs/xfs/xfsprogs-dev.git/tree/mkfs/xfs_mkfs.c
- NullVoxPopuli benchmark — https://github.com/NullVoxPopuli/disk-perf-git-and-pnpm
- Theo: "Why I'm moving to Linux (for real)" — https://www.youtube.com/watch?v=9tGrhrVKCrE ;
  "MacOS Is Making Your Mac Slow" — https://www.youtube.com/watch?v=4wVNFaFDIn8

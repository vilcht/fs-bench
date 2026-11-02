# Talk script (10 minutes)

19 slides. Times are targets; the rounds are where you can speed up or slow down. The `/notes` view shows the same
lines next to the slide, and `/notes-draft` lets you practice with them without a key (timer included). The deck's notes and target times are copied from this table, so edit them here and re-sync.

| # | Slide | Time | Say |
|---|---|---|---|
| 1 | Title | 0:25 | "Ten minutes on why the machine you run coding agents on matters more than you think. Scan the code, there's a game with points." |
| 2 | One agent, one worktree | 0:25 | "Every agent gets its own copy of the repo and runs `pnpm install` in it. Each square is a thousand files. Sixteen agents: over a million files created and deleted." |
| 3 | Lineup | 0:15 | "One laptop, dual-booted Linux and Windows: same CPU, same SSD. Plus a MacBook Air. Same repo, same tools, offline installs." |
| 4 | How to play | 0:15 | "You see one result, then guess how many times as long the next one takes. Closest guess, most points." |
| 5 | Round: MacBook | 0:35 | "Linux on the laptop: 22.7 seconds. The Mac has a CPU three and a half times faster…" *Reveal:* "One and a half times **slower**." |
| 6 | Round: Spotlight | 0:25 | "Everyone blames Spotlight. Same Mac, folder Spotlight skips." *Reveal:* "No difference." |
| 7 | Round: Windows | 0:35 | "Same laptop, booted into Windows." *Reveal:* "Seventeen times. Six and a half minutes, identical hardware." |
| 8 | Round: ext4 | 0:25 | "Linux again, but ext4 instead of Fedora's default btrfs." *Reveal:* "Four times faster. Only the filesystem changed." |
| 9 | The race | 0:25 | "All of them on one clock. ext4 is done before you can see it. Windows is still going." |
| 10 | Round: delete | 0:25 | "Cleaning up. ext4 deletes everything in under two seconds." *Reveal:* "The Mac: 21 times as long." |
| 11 | Leaderboard | 0:15 | "And the winner is… So, why?" |
| 12 | It's paperwork | 0:30 | "An install barely moves any data. It's hundreds of thousands of tiny requests to the operating system: make this folder, link this file. Sixteen agents: millions at once. A faster SSD doesn't help." |
| 13 | Two problems | 0:40 | "Two separate problems. Left to right: how slow is one agent alone. Bottom to top: does running sixteen at once help. ext4 is cheap and parallel. btrfs is cheap, but agents wait in line. On the Mac every file is expensive. Windows has both." |
| 14 | Why btrfs looked like the future | 0:50 | "For years btrfs was 'the future' and ext4 the old workhorse. In 2008 ext4's own maintainer called it a bridge to btrfs, and Fedora made btrfs the default in 2020. The idea: never overwrite anything, write every change as a new copy up one big tree. That gives you free snapshots, checksums that catch a dying disk, compression, instant copies. ext4 just updates its records in place: boring. But 'never overwrite' means every tiny change rewrites its path to the top of that one tree, and every agent has to pass through the top. With one user you never notice. With sixteen agents they queue: seven times more waiting." |
| 15 | Why APFS is built this way | 0:45 | "APFS replaced a filesystem from 1998, and it shipped on the iPhone first, in 2017. Apple built it for flash storage, with encryption as a primary feature. Like btrfs it never overwrites its records: that buys crash safety, instant clones, snapshots for Time Machine and system updates. Perfect for a phone: one person, one app, precious photos. Agents are the opposite. Every create and delete rewrites tree nodes, and it doesn't get faster with more threads: five times slower per file than Linux, on a faster CPU." |
| 16 | Why Windows checks every file | 0:40 | "On Windows it's not really the filesystem. After twenty years of malware, every Windows since 8 ships with Defender, and it sits in front of the disk: every file is checked when it's opened, and the program waits. Invisible for normal use, it stops a lot of attacks. A developer opening millions of files pays it millions of times. Microsoft knows: Dev Drive, from 2023, checks code folders later instead of first. We haven't measured it yet." |
| 17 | Built for a different job | 0:35 | "None of these are bad filesystems. They were built for a different job: files are precious, one person does one thing at a time, files change now and then. Agents break all three. node_modules is disposable, sixteen agents run around 950 threads, and they churn through millions of tiny files. We pay for snapshots, checksums, encryption and virus scans on files we delete an hour later." |
| 18 | What to do | 0:30 | "More agents isn't free: on btrfs and Windows, sixteen at once take as long as sixteen in a row. Reuse worktrees. On Linux, use ext4 for agent work. On Windows, get off scanned NTFS. On the Mac, keep pnpm's defaults." |
| 19 | Run it yourself | 0:10 | "One command, any OS. Thanks!" |

Total ≈ 9:05, which leaves a minute of slack for questions or slow voting. If you run long, shorten slides 13 and 15 to one sentence each.

## If someone asks

- **"So is btrfs bad?"** No. Snapshots and checksums are real benefits for your home folder and your data. Agent
  scratch space (worktrees, node_modules) doesn't need them, so put that on ext4, or a separate volume.
- **"Isn't the Mac's SSD fast?"** It is, faster than the laptop's. The work isn't data, it's millions of small
  bookkeeping requests, and those are handled by the operating system.
- **"Is the Mac's problem APFS or macOS?"** We can't separate them from our data. Linux running in a VM on the same
  Apple chip is several times faster, so it's the software, not the chip.
- **"Why not just turn off Defender?"** It's your protection; don't turn it off globally. Dev Drive is
  Microsoft's supported way to relax scanning for code folders. WSL2 is the other option. Both untested here.
- **"How sure are the Windows numbers?"** One measured run (a full run takes over an hour), Defender on as shipped.
  It's 17× on identical hardware, so the conclusion holds even if the exact number moves.
- **"Doesn't pnpm copy everything on Linux?"** No, it hard links from its store on every filesystem we tested. If
  you see copying, your store is on a different disk or partition.
- **"Theo said this too?"** Yes, his videos show the same Mac vs Linux gap. We add Windows and the "why".

## Sources for the history

- ext4 as a bridge to btrfs (Ted Ts'o, 2008): [Slashdot/heise summary](https://linux.slashdot.org/story/08/10/20/038230/ext4-advances-as-interim-step-to-btrfs), [linux-ext4 list, July 2008](https://lists.openwall.net/linux-ext4/2008/07/27/23)
- Fedora 33 makes btrfs the default (2020): [Fedora change proposal](https://fedoraproject.org/wiki/Changes/BtrfsByDefault)
- APFS, WWDC 2016, "optimized for Flash/SSD storage, engineered with encryption as a primary feature": [InfoQ](https://www.infoq.com/news/2016/06/apfs-apple-file-system), [Wikipedia](https://en.wikipedia.org/wiki/Apple_File_System)
- Defender "open now, scan now" vs Dev Drive "scan later": [Microsoft: performance mode](https://learn.microsoft.com/en-us/defender-endpoint/microsoft-defender-endpoint-antivirus-performance-mode)
- Measurement details (syscall counts, kernel profiles): `lab/README.md`

# Talk script (10 minutes)

18 slides. Times are targets; the rounds are where you can speed up or slow down. The `/notes` view shows the same
lines next to the slide.

| # | Slide | Time | Say |
|---|---|---|---|
| 1 | Title | 0:30 | "Ten minutes on why the machine you run coding agents on matters more than you think. Scan the code, there's a game with points." |
| 2 | One agent, one worktree | 0:30 | "Every agent gets its own copy of the repo and runs `pnpm install` in it. Each square is a thousand files. Sixteen agents: over a million files created and deleted." |
| 3 | Lineup | 0:20 | "One laptop, dual-booted Linux and Windows: same CPU, same SSD. Plus a MacBook Air. Same repo, same tools, offline installs." |
| 4 | How to play | 0:20 | "You see one result, then guess how many times as long the next one takes. Closest guess, most points." |
| 5 | Round: MacBook | 0:40 | "Linux on the laptop: 22.7 seconds. The Mac has a CPU three and a half times faster…" *Reveal:* "One and a half times **slower**." |
| 6 | Round: Spotlight | 0:30 | "Everyone blames Spotlight. Same Mac, folder Spotlight skips." *Reveal:* "No difference." |
| 7 | Round: Windows | 0:40 | "Same laptop, booted into Windows." *Reveal:* "Seventeen times. Six and a half minutes, identical hardware." |
| 8 | Round: ext4 | 0:30 | "Linux again, but ext4 instead of Fedora's default btrfs." *Reveal:* "Four times faster. Only the filesystem changed." |
| 9 | The race | 0:30 | "All of them on one clock. ext4 is done before you can see it. Windows is still going." |
| 10 | Round: delete | 0:30 | "Cleaning up. ext4 deletes everything in under two seconds." *Reveal:* "The Mac: 21 times as long." |
| 11 | Leaderboard | 0:20 | "And the winner is… So, why?" |
| 12 | It's paperwork | 0:40 | "An install barely moves any data. It's hundreds of thousands of tiny requests to the operating system: make this folder, link this file. Sixteen agents: millions at once. A faster SSD doesn't help, because it's bookkeeping, not data." |
| 13 | Two problems | 0:50 | "Two separate problems. Left to right: how slow is one agent alone. Bottom to top: does running sixteen at once help. On the dashed line it doesn't help at all. ext4 is cheap and parallel. btrfs is cheap, but agents wait in line. On the Mac every file is expensive. Windows has both." |
| 14 | ext4 vs btrfs | 0:40 | "Same requests, so why four times faster? ext4 updates its records in place and saves its journal in big batches. btrfs never overwrites anything: every change is written as a copy, all the way up one big tree, and every agent has to pass through the top of that tree. We measured it: seven times more waiting." |
| 15 | macOS | 0:40 | "On the Mac, every file costs more: one agent alone is five times slower than Linux, on a faster CPU. Almost all of that time is inside macOS itself, not pnpm or git. And it wasn't Spotlight." |
| 16 | Windows | 0:40 | "Windows is slow even with one agent. The big toll is Defender: it checks every file the moment it's opened, and the program waits. Microsoft's Dev Drive checks afterwards instead; we haven't measured that yet." |
| 17 | What to do | 0:40 | "More agents isn't free: on btrfs and Windows, sixteen at once take as long as sixteen in a row. Reuse worktrees. On Linux, use ext4. On Windows, get off scanned NTFS. On the Mac, keep pnpm's defaults." |
| 18 | Run it yourself | 0:10 | "One command, any OS. Thanks!" |

Total ≈ 9:40.

## If someone asks

- **"Isn't the Mac's SSD fast?"** It is, faster than the laptop's. The work isn't reading or writing data, it's
  millions of small bookkeeping requests, and those are handled by the operating system.
- **"Why does btrfs queue?"** Everything lives in one tree, and changes are copied up to its top. During deletes,
  most of the kernel's time was agents waiting for that one top spot.
- **"Is the Mac's problem APFS or macOS?"** We can't separate them from our data. Others found that Linux running
  in a VM on the same Apple chip is several times faster, so it's the software, not the chip.
- **"How sure are the Windows numbers?"** One measured run (a full run takes over an hour), Defender on as shipped.
  It's 17× on identical hardware, so the conclusion holds even if the exact number moves.
- **"Doesn't pnpm copy everything on Linux?"** No, it hard links from its store on every filesystem we tested. If
  you see copying, your store is on a different disk or partition.
- **"Theo said this too?"** Yes, his videos show the same Mac vs Linux gap. We add Windows and the "why".

Measurement details (syscall counts, kernel profiles) are in `lab/README.md`.

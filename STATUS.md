# Status and next steps

Knowledge-sharing talk (10 min, remote): why the filesystem/OS decides how many coding agents you can run in
parallel. The benchmark lives in the repo root; the live slide site lives in `talk/`.

## Done

- **Benchmark** (`run.sh` one-liner, `fsbench.sh`): worktree add → `pnpm install --offline` → `git status` →
  worktree remove, 1/2/4/8/16 agents at once, l2beat pinned at `e91c705232`. Per-agent timings
  (`agents.csv`) and resource samples: CPU busy %, kernel share, RAM, disk (`samples.csv`).
  Linux, macOS, Windows (Git Bash, optional Dev Drive), WSL.
- **Talk site** (`talk/`, Cloudflare Worker + Durable Object): 18 slides, 5 higher/lower rounds, all on real
  data (no MOCK badges). Live audience cursors, leaderboard, presenter view (`/present?key=…`), speaker notes
  (`/notes?key=…`). See `talk/README.md` for running and deploying.

## The story the deck tells

One Huawei laptop (Core Ultra 5 125H, 16 GB, WD SN740), dual-booted Fedora and Windows 11, against a MacBook Air
(M4, 16 GB). Setup (worktree add + install, `auto`) with 16 agents at once:

| | setup | delete |
|---|---|---|
| Laptop, Linux ext4 (volume) | 5.2 s | 1.8 s |
| Laptop, Linux btrfs (volume) | 17.8 s | 15.1 s |
| Laptop, Linux btrfs (home, Fedora default, zstd) | 22.7 s | 15.1 s |
| Laptop, Linux xfs (volume) | 25.7 s | 16.0 s |
| MacBook Air, APFS | 34.6 s | 38.3 s |
| MacBook Air, APFS in `.noindex` | 35.5 s | 52.9 s |
| Laptop, Windows NTFS + Defender | 393 s | 113 s* |

Rounds: Mac vs laptop btrfs (1.5×), Spotlight off (1.0×), Windows vs Linux on the same laptop (17×), ext4 vs btrfs
(0.23×), Mac delete vs ext4 delete (21×). The two "why" slides cite the data; the claims to verify before
presenting are in their speaker notes.

The Ryzen desktop runs are still in `results/` (and in `summarize.py`), but `talk/machines.json` doesn't map them:
the laptop's Linux-vs-Windows comparison on identical hardware is the fairer one.

## Caveats to say out loud (or keep in mind)

- **Windows is one measured run** (the full run took over an hour and was stopped early; see
  `results/ntfs-NTFS-20261102-081619/README.md`). *Its delete at 8 agents failed, and its removal
  procedure differed (Node recursive delete before `git worktree remove`), so the deck doesn't use Windows deletes.
- **Windows resources**: Git Bash's `times` can't see native Windows processes, so there's no kernel split. The
  sampler stopped before the measured rep, so CPU busy / RAM / disk come from the warmup rep (a full run too:
  307 s vs 323 s install). `talk/scripts/build_data.py` handles both and the slide footnotes it.
- **Spotlight**: the `.noindex` pass runs second, and the fanless Air was warmer by then (its CPU baseline with 16
  processes went from 3.7 s to 4.9 s). Even so, nothing points at Spotlight.
- **Mac runs** were recorded before the `fs` detection fix; `fs` was set to `apfs` by hand.
- The Windows run used the label `ntfs`; `machines.json` maps it to `huawei-win`. Future Windows runs should use
  `LABEL=intel-core-ultra-5-125h-windows` (also mapped) or a new entry.

## Next steps

1. Rehearse with `/notes?key=…` on a second screen; trim the speaker notes to your own words.
2. Before the talk, open `/present?key=…` and press `Shift+R` to clear test votes and players.
3. Optional, for a later version: Dev Drive and WSL2 runs on the laptop (the Dev Drive check needs an admin
   shell: it failed with "access denied"), a full 3-rep Windows run, and the Mac mini.

# Status and next steps

Knowledge-sharing talk (10 min, remote): why the filesystem/OS decides how many coding agents you can run in
parallel. The benchmark lives in the repo root; the live slide site lives in `talk/`.

## Done

- **Benchmark** (`run.sh` one-liner, `fsbench.sh`): worktree add → `pnpm install --offline` → `git status` →
  worktree remove, 1/2/4/8/16 agents at once, l2beat pinned at `e91c705232`. Per-agent timings
  (`agents.csv`) and resource samples: CPU busy %, kernel share, RAM, disk (`samples.csv`).
  Linux, macOS, Windows (Git Bash, optional Dev Drive), WSL.
- **Talk site** (`talk/`, Cloudflare Worker + Durable Object): 21 slides, 7 higher/lower rounds,
  live audience cursors, leaderboard, presenter view (`/present?key=…`), speaker notes (`/notes?key=…`).
  See `talk/README.md` for running and deploying.

## Verified vs untested

- Verified on Linux (Fedora, btrfs): full runs, test volumes, resource sampling, the one-liner.
  The whole site was tested headless: rounds, scoring, cursors, phone layout.
- Verified on macOS (MacBook Air M4, macOS 27): full run of both APFS passes, including the macOS branch of
  `sampler.pl`. That run recorded an empty `fs` (the `diskutil` key was wrong) and the tarball had `._*` files;
  both are fixed but the fixes haven't been re-run on a Mac yet.
- **Untested: Windows benchmark runs**, including `sampler.ps1`. Do the 2-minute smoke run first:
  `curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | NS=1 REPS=0 METHODS=auto VOLUMES= bash`

## Data so far

`results/` has real runs for 6 of the 14 configs the deck expects:

- Desktop (Ryzen 5 5600X, Fedora): btrfs home, plus ext4, xfs and btrfs test volumes.
- MacBook Air (M4, 16 GB): APFS with Spotlight on, and in a `.noindex` directory (Spotlight off).
  Those Mac runs were recorded with an empty `fs`; it was set to `apfs` by hand and the directories renamed to match.

Everything else on the slides (Mac mini, Huawei, Windows, WSL) is still **mock data, flagged with a red MOCK
DATA badge**. `python3 summarize.py` prints the medians.

What it shows so far, setup (worktree add + install, `auto`) with 16 agents at once:
ext4 6.0 s, btrfs volume 17.4 s, xfs 19.7 s, btrfs home 23.9 s, APFS 34.6 s. Remove with 16 agents: ext4 2.0 s,
APFS 38–53 s. The M4 is about 3× faster than the 5600X on the CPU-only baseline, so APFS's lag is filesystem
work, not hardware (kernel share of CPU: 86–91% during install, 98–99% during remove). Forcing `hardlink` on APFS
is far slower than `auto` (clones): 133–203 s vs 25 s for setup with 16 agents.

Caveat: the Spotlight-off pass runs second, and the fanless Air was hotter by then (its CPU baseline with 16
processes went from 3.7 s to 4.9 s). So "Spotlight off" coming out no faster is probably heat, not Spotlight.
Let the Mac cool down before the second pass, or run the passes in the other order to check.

## Next steps

1. Run the full one-liner on every machine (about 1 h each, plugged in, idle, nothing else running):
   - MacBook: `… | LABEL=macbook bash`, Mac mini: `… | LABEL=macmini bash` (same chip = same auto label)
   - Desktop on Linux, Huawei laptop on Linux: plain one-liner (asks for sudo for the ext4/xfs/btrfs volumes)
   - Desktop on Windows (Git Bash), optionally `DEV_DRIVE=/d`; desktop in WSL: plain one-liner
2. Unpack each `fsbench-results-*.tar.gz` into `results/`, fill in the Mac models and check the labels in
   `talk/machines.json`, then `cd talk && pnpm data`. It prints which configs are real. The MacBook Air ran
   with the auto label `apple-m4-macos`, now mapped to `macbook`; if the Mac mini is also an M4, run it with
   `LABEL=macmini` so the two don't collide.
3. Cut the deck to fit 10 minutes. Rounds take about 30 s each, so 7 is about 4 min; candidates to drop:
   the WSL2 round, the scaling chart, the Linux-filesystems slide.
4. Write your own explanation on the two "why" slides (claims to verify are in their speaker notes).
5. Deploy: `cd talk && pnpm install && pnpm exec wrangler login && pnpm exec wrangler secret put PRESENTER_KEY && pnpm deploy`.
   Before the talk, open `/present?key=…` and press `Shift+R` to clear test votes and players.

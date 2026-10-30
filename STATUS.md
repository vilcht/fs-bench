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
- **Untested: Windows and macOS benchmark runs**, including both resource samplers (`sampler.ps1`,
  the macOS branch of `sampler.pl`). Do the 2-minute smoke run on each machine first:
  `curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | NS=1 REPS=0 METHODS=auto VOLUMES= bash`

## Data so far

`results/` has only two real runs: the desktop's xfs and btrfs test volumes (old format, no per-agent
timings or resource samples). Everything else on the slides is **mock data, flagged with a red MOCK DATA
badge**. Early finding from a short test run on the desktop's btrfs home with 16 agents: the kernel accounted
for 85% of CPU time during install and 97% during delete.

## Next steps

1. Run the full one-liner on every machine (about 1 h each, plugged in, idle, nothing else running):
   - MacBook: `… | LABEL=macbook bash`, Mac mini: `… | LABEL=macmini bash` (same chip = same auto label)
   - Desktop on Linux, Huawei laptop on Linux: plain one-liner (asks for sudo for the ext4/xfs/btrfs volumes)
   - Desktop on Windows (Git Bash), optionally `DEV_DRIVE=/d`; desktop in WSL: plain one-liner
2. Unpack each `fsbench-results-*.tar.gz` into `results/`, fill in the Mac models and check the labels in
   `talk/machines.json`, then `cd talk && pnpm data`. It prints which configs are real.
3. Cut the deck to fit 10 minutes. Rounds take about 30 s each, so 7 is about 4 min; candidates to drop:
   the WSL2 round, the scaling chart, the Linux-filesystems slide.
4. Write your own explanation on the two "why" slides (claims to verify are in their speaker notes).
5. Deploy: `cd talk && pnpm install && pnpm exec wrangler login && pnpm exec wrangler secret put PRESENTER_KEY && pnpm deploy`.
   Before the talk, open `/present?key=…` and press `Shift+R` to clear test votes and players.

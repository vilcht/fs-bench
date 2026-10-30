# fs-bench: worktrees + pnpm installs for parallel agents

How well does a filesystem hold up when many coding agents spin up their own worktree at once?
This measures what each agent does on start and finish: `git worktree add`, `pnpm install`
(offline, warm store), `git status`, then `git worktree remove`. It runs 1, 2, 4, 8 and 16 at a time
on the [l2beat](https://github.com/l2beat/l2beat) monorepo (~11.7k tracked files, ~53k files in
`node_modules`), pinned to the same commit on every machine.

## Run it

Plug in, close heavy apps, and leave the machine alone for about an hour.

```sh
curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash
```

- **macOS:** APFS, run twice: once as-is, once in a directory Spotlight skips (`*.noindex`). Needs git
  (`xcode-select --install`).
- **Linux:** your home filesystem, then ext4, xfs and btrfs test volumes (image files on the same disk).
  Asks for sudo to mount them.

At the end it prints the path of a `fsbench-results-<cpu>-<date>.tar.gz`: send that file back.

Quick smoke test (~2 min, home filesystem only):

```sh
curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | NS=1 REPS=0 METHODS=auto VOLUMES= bash
```

## What it does

1. Clones this repo to `~/fs-bench` and downloads Node 22.22.3 into `~/fs-bench/.tools`.
   It doesn't touch the system install. pnpm 12.3.4 comes from l2beat's `packageManager` via corepack.
2. Fetches l2beat at the pinned commit and fills a pnpm store on the filesystem under test
   (network; not timed).
3. CPU baseline: N parallel Node processes hashing in a loop, no disk. It tells hardware speed
   apart from filesystem speed.
4. For N in 1, 2, 4, 8, 16, with 3 reps plus a warmup:

   | Phase | What | Stresses |
   |---|---|---|
   | `worktree_add` | N × `git worktree add` | creating many files at once |
   | `install` | N × `pnpm install --offline --ignore-scripts` | creating files, directories and symlinks |
   | `git_status` | N × `git status` | checking whether files changed |
   | `remove` | N × `git worktree remove --force` | deleting many files at once |

   Each runs with pnpm's default import method (`auto`: clone → hardlink → copy) and with
   `hardlink` forced, which puts every filesystem on the same path.
5. Packs `results/` into the tarball and deletes the benchmark data (`KEEP_DATA=1` keeps it).

The headline metric is seconds per agent as N grows. Flat means the filesystem keeps up with parallel agents;
climbing means it's choking on contention.

Parallel `git worktree add` can race (`fatal: failed to read .git/worktrees/<n>/commondir`).
The benchmark retries up to 5 times and logs `fsbench-retry` in the job log.

## Manual use

```sh
./fsbench.sh <dir> [label]        # one run on whatever filesystem <dir> is on
./linux-all.sh [label]            # Linux: home + ext4/xfs/btrfs volumes, sequentially
sudo ./mkvol.sh up|down <fs>      # Linux: loop-mounted test volume at /mnt/fsbench-<fs>
python3 summarize.py              # median tables for everything in results/
```

Knobs (env): `LABEL`, `SOURCE=/path/to/l2beat` (skip cloning from GitHub), `NS="1 4 16"`, `REPS=2`,
`METHODS="auto hardlink copy"`, `VOLUMES="ext4"` (Linux volumes; empty for home only).

Results land in `results/<label>-<fs>-<timestamp>/` (`results.csv`, `machine.txt`, `logs/`).
Rep 0 is a warmup and is dropped from the summary. Never run two benchmarks at once on the same machine:
they slow each other down and invalidate both.

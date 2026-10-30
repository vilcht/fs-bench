# fs-bench: worktrees + pnpm installs for parallel agents

Measures what an agent does when it starts on a task: `git worktree add`, `pnpm install`
(offline, warm store), `git status`, then `git worktree remove`. It runs 1, 2, 4, 8 and 16 at a time,
on the l2beat repo pinned to the same commit on every machine. It also times a CPU-only task
(sha256 in Node, no disk), so the results can be normalised by hardware speed.

Results land in `results/<label>-<fs>-<timestamp>/` (`results.csv`, `machine.txt`, `logs/`).
Rep 0 is a warmup.

Takes roughly 15–60 min per run depending on the machine. Don't use the machine while it runs.

## macOS

1. Plug in power, turn Low Power Mode off, quit heavy apps.
2. `xcode-select --install` (for git) if `git` isn't there yet.
3. Node 22 (`brew install node@22` or nvm) and pnpm (`npm i -g pnpm`; the repo pins
   pnpm 12.3.4 and pnpm switches to it on its own).
4. Run twice. The `.noindex` suffix keeps Spotlight out of the second directory:

   ```sh
   ./fsbench.sh ~/fsbench        mac
   ./fsbench.sh ~/fsbench.noindex mac
   ```

5. Send back the `results/` folder. Then delete `~/fsbench` and `~/fsbench.noindex`.

## Linux

The real setup first (the home directory, whatever filesystem it is on):

```sh
./fsbench.sh ~/fs-bench-data/home "$(hostname -s)"
```

Then ext4 / xfs / btrfs on equal footing: same disk, same loop-device overhead.

```sh
for fs in ext4 xfs btrfs; do
  sudo ./mkvol.sh up $fs
  ./fsbench.sh /mnt/fsbench-$fs "$(hostname -s)"
  sudo ./mkvol.sh down $fs
done
```

On a laptop, plug it in and set the power profile to performance (`powerprofilesctl set performance`).

## Knobs

`SOURCE=/path/to/l2beat` (skip cloning from GitHub), `NS="1 4 16"`, `REPS=2`,
`METHODS="auto hardlink copy"`. `auto` is pnpm's default (clone → hardlink → copy fallback).
`hardlink` puts every filesystem on the same import path.

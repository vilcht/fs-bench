# lab: where the kernel spends its time

Kernel profiles behind the "under the hood" slides. Linux only, needs root (loop volumes, bpftrace).

```sh
sudo dnf install bpftrace          # or your distro's package
./profile.sh ext4 ext4             # fresh 48 GB ext4 volume, 16 agents, profiled
./profile.sh xfs xfs-biglog -l size=1g   # extra args go to mkfs
python3 stacks.py out/ext4         # summary per phase
```

`profile.sh <fs> <tag> [mkfs args…]` creates a 48 GB loop image on your home filesystem (direct I/O, CoW off),
fetches l2beat at the benchmark's pinned commit (`SOURCE=` for a local clone), warms a pnpm store on the volume,
runs one unprofiled round and one profiled round of 16× `git worktree add` → 16× `pnpm install --offline` →
16× `git worktree remove`, then tears the volume down. Node and pnpm come from `~/fs-bench/.tools` (installed by
`run.sh`).

Each profiled phase gets its own bpftrace session (`prof.bt`), filtered to git and pnpm 12's native installer
threads (`pnpm-native`, `pacquet-*`, `tokio-rt-*`):

- **on-CPU:** kernel stacks sampled at 499 Hz (user-mode samples counted, with an empty stack);
- **off-CPU:** voluntary sleep time, summed by the kernel stack where the thread went to sleep.

`stacks.py` reports, per phase: kernel share, kernel time by syscall, hottest kernel functions, how much is lock
spinning, and the top wait sites. It leaves out idle thread-pool waits (futex, epoll).

## Results (Fedora 44, kernel 7.2.7, Core Ultra 5 125H, WD SN740)

`results/` holds the summaries (`*.txt`) and `strace -f -c` counts for one agent (`strace-*.txt`).

| | install 16 | delete 16 | install: asleep (thread-s) | main wait / spin site |
|---|---|---|---|---|
| ext4 | 3.3 s | 1.5 s | 1,200 | VFS per-directory lock (`filename_create`), journal checkpoint |
| xfs (64 MiB log, parent pointers) | 21.5 s | 15.7 s | 11,600 | log reservation: `xlog_grant_head_wait` (53% of waiting) |
| xfs, 1 GiB log | 21.9 s | 7.9 s | 11,000 | spinning on the log grant-head lock (≈ 74% of kernel time) |
| xfs, `-n parent=0` | 16.8 s | 6.3 s | 8,700 | log reservation, less work per link |
| btrfs | 15.5 s | 17.6 s | 8,000 | metadata reservation tickets; delete: B-tree root lock (`osq_lock` 53%) |

Per agent (strace): `git worktree add` 97k syscalls, `pnpm install` 202k (52,955 `linkat`), `git worktree remove`
215k (68k `unlink`). pnpm hard linked on every Linux filesystem.

Profiling overhead was negligible: ext4 install took 3.30 s profiled vs 3.39 s unprofiled in the same run.

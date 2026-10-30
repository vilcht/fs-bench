#!/usr/bin/env bash
# Filesystem benchmark for "many agents in parallel" workflows on the l2beat repo.
# Runs on Linux and macOS (bash 3.2 compatible).
#
#   ./fsbench.sh <bench-dir> [label]
#
# Env overrides:
#   SOURCE   git source for the repo (default: GitHub; a local clone path is faster)
#   COMMIT   commit to check out everywhere (keep identical across machines)
#   NS       parallelism levels                       (default "1 2 4 8 16")
#   REPS     measured repetitions per configuration   (default 3, plus 1 warmup)
#   METHODS  pnpm import methods: auto hardlink copy  (default "auto hardlink")
set -u

BENCH_DIR=${1:?usage: fsbench.sh <bench-dir> [label]}
LABEL=${2:-$(hostname -s)}
SOURCE=${SOURCE:-https://github.com/l2beat/l2beat.git}
COMMIT=${COMMIT:-e91c7052327199d7bef160c7f1ef731760c2bc35}
NS=${NS:-"1 2 4 8 16"}
REPS=${REPS:-3}
METHODS=${METHODS:-"auto hardlink"}

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
OS=$(uname -s)
mkdir -p "$BENCH_DIR"
BENCH_DIR=$(cd "$BENCH_DIR" && pwd)
REPO=$BENCH_DIR/repo
STORE=$BENCH_DIR/store
WT=$BENCH_DIR/wt

export npm_config_update_notifier=false
ulimit -n 65536 2>/dev/null || ulimit -n 10240 2>/dev/null || true

die() { echo "error: $*" >&2; exit 1; }
for bin in git node pnpm; do command -v $bin >/dev/null || die "$bin not found"; done

if [ -n "${EPOCHREALTIME:-}" ]; then
  now() { echo "$EPOCHREALTIME"; }
elif command -v perl >/dev/null; then
  now() { perl -MTime::HiRes=time -e 'printf "%.3f\n", time'; }
else
  now() { node -e 'console.log((Date.now() / 1000).toFixed(3))'; }
fi

fs_type() {
  if [ "$OS" = Darwin ]; then
    diskutil info "$(df -P "$1" | tail -1 | awk '{print $1}')" |
      awk -F: '/Type \(Personality\)/ { gsub(/^ +/, "", $2); print $2 }'
  else
    findmnt -no FSTYPE -T "$1"
  fi
}

FS=$(fs_type "$BENCH_DIR" | tr ' ' '_')
case "$BENCH_DIR" in *.noindex*) SPOTLIGHT=off ;; *) SPOTLIGHT=on ;; esac
[ "$OS" = Darwin ] || SPOTLIGHT=n/a

OUT=$SCRIPT_DIR/results/$LABEL-$FS-$(date +%Y%m%d-%H%M%S)
LOGS=$OUT/logs
mkdir -p "$LOGS"
CSV=$OUT/results.csv
echo "label,os,fs,spotlight,method,phase,n,rep,seconds,ok" >"$CSV"

machine_info() {
  echo "label: $LABEL"
  echo "bench_dir: $BENCH_DIR"
  echo "fs: $FS"
  echo "spotlight: $SPOTLIGHT"
  echo "commit: $COMMIT"
  echo "node: $(node -v)  pnpm: $(cd "$REPO" && pnpm -v)  $(git --version)"
  echo "uname: $(uname -a)"
  if [ "$OS" = Darwin ]; then
    sw_vers
    echo "cpu: $(sysctl -n machdep.cpu.brand_string)"
    echo "cores: $(sysctl -n hw.ncpu) (perf: $(sysctl -n hw.perflevel0.physicalcpu 2>/dev/null), eff: $(sysctl -n hw.perflevel1.physicalcpu 2>/dev/null))"
    echo "mem_bytes: $(sysctl -n hw.memsize)"
    echo "filevault: $(fdesetup status 2>/dev/null)"
    pmset -g batt 2>/dev/null | head -2
    pmset -g 2>/dev/null | grep -i lowpowermode
    diskutil info "$(df -P "$BENCH_DIR" | tail -1 | awk '{print $1}')" |
      grep -E 'Type \(Personality\)|Device / Media Name|Solid State|Protocol|Encrypted|Case-sensitive'
  else
    echo "cpu: $(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2-)"
    echo "cores: $(nproc)"
    grep MemTotal /proc/meminfo
    findmnt -no SOURCE,FSTYPE,OPTIONS -T "$BENCH_DIR"
    lsblk -no NAME,MODEL,FSTYPE "$(findmnt -no SOURCE -T "$BENCH_DIR" | sed 's/\[.*//')" 2>/dev/null
    cat /sys/firmware/acpi/platform_profile 2>/dev/null | sed 's/^/platform_profile: /'
    cat /sys/class/power_supply/AC*/online 2>/dev/null | sed 's/^/ac_online: /'
  fi
}
record() { # method phase n rep seconds ok
  echo "$LABEL,$OS,$FS,$SPOTLIGHT,$1,$2,$3,$4,$5,$6" >>"$CSV"
  printf '  %-9s %-14s n=%-2s rep=%s  %8.2fs %s\n' "$1" "$2" "$3" "$4" "$5" "$([ "$6" = 1 ] || echo FAILED)"
}

# Runs `$fn i` for i in 1..n concurrently and records the wall time of the batch.
run_parallel() { # method phase n rep fn
  local method=$1 phase=$2 n=$3 rep=$4 fn=$5 i pids="" ok=1 t0 t1
  t0=$(now)
  i=1
  while [ $i -le $n ]; do
    "$fn" $i >"$LOGS/$method-$phase-n$n-r$rep-$i.log" 2>&1 &
    pids="$pids $!"
    i=$((i + 1))
  done
  for p in $pids; do wait $p || ok=0; done
  t1=$(now)
  record "$method" "$phase" "$n" "$rep" "$(awk "BEGIN{print $t1 - $t0}")" $ok
}

import_flag() {
  [ "$METHOD" = auto ] || echo "--config.package-import-method=$METHOD"
}

job_cpu() { # fixed CPU work, no disk: baseline for hardware speed
  node -e '
    const c = require("crypto"); let h = Buffer.alloc(64);
    for (let i = 0; i < 3e6; i++) h = c.createHash("sha256").update(h).digest();'
}
job_worktree() { git -C "$REPO" worktree add --detach "$WT/$1" "$COMMIT"; }
job_install() {
  cd "$WT/$1" && pnpm install --offline --frozen-lockfile --ignore-scripts \
    --store-dir "$STORE" --config.confirm-modules-purge=false $(import_flag) &&
    [ -f node_modules/.modules.yaml ]
}
job_status() { git -C "$WT/$1" status --porcelain | (! grep -q .); }
job_remove() { git -C "$REPO" worktree remove --force "$WT/$1"; }

cleanup_worktrees() {
  [ -d "$WT" ] && chmod -R u+w "$WT" 2>/dev/null && rm -rf "$WT"
  git -C "$REPO" worktree prune
  mkdir -p "$WT"
  sync
}

echo
echo "== setup: repo at $COMMIT"
if [ ! -d "$REPO/.git" ]; then
  src=$SOURCE
  [ -d "$src" ] && src="file://$(cd "$src" && pwd)"
  git init -q "$REPO" &&
    git -C "$REPO" fetch -q --depth 1 "$src" "$COMMIT" &&
    git -C "$REPO" checkout -q --detach FETCH_HEAD || die "could not fetch $COMMIT from $SOURCE"
fi

machine_info >"$OUT/machine.txt" 2>&1
cat "$OUT/machine.txt"

echo "== setup: warm pnpm store (network, not part of the comparison)"
t0=$(now)
(cd "$REPO" && pnpm install --frozen-lockfile --ignore-scripts --store-dir "$STORE" \
  --config.confirm-modules-purge=false >"$LOGS/store-warm.log" 2>&1) || die "store warm-up failed, see $LOGS/store-warm.log"
record - store_warm 1 0 "$(awk "BEGIN{print $(now) - $t0}")" 1

echo "== cpu baseline"
for n in $NS; do
  rep=0
  while [ $rep -le "$REPS" ]; do
    run_parallel - cpu "$n" "$rep" job_cpu
    rep=$((rep + 1))
  done
done

# rep 0 is a warmup; analysis should drop it.
rep=0
while [ $rep -le "$REPS" ]; do
  for METHOD in $METHODS; do
    for n in $NS; do
      echo "== rep $rep, $METHOD, n=$n"
      cleanup_worktrees
      run_parallel "$METHOD" worktree_add "$n" "$rep" job_worktree; sync
      run_parallel "$METHOD" install "$n" "$rep" job_install; sync
      run_parallel "$METHOD" git_status "$n" "$rep" job_status; sync
      run_parallel "$METHOD" remove "$n" "$rep" job_remove; sync
    done
  done
  rep=$((rep + 1))
done
cleanup_worktrees

echo
echo "done: $CSV"

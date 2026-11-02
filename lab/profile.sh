#!/usr/bin/env bash
# lab2.sh <fs> [tag] [mkfs-extra-args...]: fresh volume, 16 agents, warmup round + profiled round (bpftrace per phase).
set -u
fs=$1; tag=${2:-$fs}; shift 2 2>/dev/null || shift $#
LAB=$(cd "$(dirname "$0")" && pwd); OUT=$LAB/out/$tag; rm -rf "$OUT"; mkdir -p "$OUT"
export PATH=$HOME/fs-bench/.tools/bin:$HOME/fs-bench/.tools/node-v22.22.3-linux-x64/bin:$PATH
export npm_config_update_notifier=false
IMG=$HOME/fsb-lab-img; mkdir -p "$IMG"; img=$IMG/$fs.img; mnt=/mnt/fsbench-lab
sudo -n umount $mnt 2>/dev/null; rm -f "$img"; touch "$img"; chattr +C "$img" 2>/dev/null; fallocate -l 48G "$img"
dev=$(sudo -n losetup --find --show --direct-io=on "$img")
case $fs in
  ext4) sudo -n mkfs.ext4 -q -F -E lazy_itable_init=0,lazy_journal_init=0 "$@" "$dev" ;;
  xfs) sudo -n mkfs.xfs -q -f "$@" "$dev" ;;
  btrfs) sudo -n mkfs.btrfs -q -f "$@" "$dev" ;;
esac
sudo -n mkdir -p $mnt && sudo -n mount "$dev" $mnt && sudo -n chown "$(id -un):" $mnt
[ "$fs" = xfs ] && xfs_info $mnt > "$OUT/xfs_info.txt"
B=$mnt; N=16
git init -q $B/repo && git -C $B/repo fetch -q --depth 1 "${SOURCE:-https://github.com/l2beat/l2beat.git}" e91c7052327199d7bef160c7f1ef731760c2bc35 && git -C $B/repo checkout -q --detach FETCH_HEAD
(cd $B/repo && pnpm install --frozen-lockfile --ignore-scripts --store-dir $B/store --config.confirm-modules-purge=false > "$OUT/warm.log" 2>&1) || { echo "store warm failed"; tail "$OUT/warm.log"; }
wt() { local a=1; until git -C $B/repo worktree add -q --force --detach $B/wt/$1 HEAD 2>/dev/null; do [ $a -ge 5 ] && return 1; a=$((a+1)); done; }
inst() { cd $B/wt/$1 && pnpm install --offline --frozen-lockfile --ignore-scripts --store-dir $B/store --config.confirm-modules-purge=false >/dev/null 2>&1; }
rmwt() { git -C $B/repo worktree remove --force $B/wt/$1; }
phase() { # name fn profile?
  local name=$1 fn=$2 prof=$3 bp t0 t1
  sync
  if [ "$prof" = 1 ]; then sudo -n bpftrace $LAB/prof.bt > "$OUT/$name.bt.txt" 2>&1 & bp=$!; sleep 3; fi
  t0=$EPOCHREALTIME
  for i in $(seq 1 $N); do $fn $i & done; wait_jobs
  t1=$EPOCHREALTIME
  if [ "$prof" = 1 ]; then sudo -n kill -INT $bp; wait $bp 2>/dev/null; fi
  echo "$name $(awk "BEGIN{printf \"%.2f\", $t1-$t0}")" | tee -a "$OUT/times.txt"
}
wait_jobs() { for j in $(jobs -p); do [ "$j" = "${bp:-x}" ] || wait $j; done; }
for round in warm prof; do
  p=0; [ $round = prof ] && p=1
  echo "== $round" >> "$OUT/times.txt"
  phase worktree_add wt $p; phase install inst $p; phase remove rmwt $p
done
sudo -n umount $mnt; sudo -n losetup -d "$dev"; rm -f "$img"
echo "$tag done"; cat "$OUT/times.txt"

#!/usr/bin/env bash
# Linux only. Loop-mounted test volume backed by a preallocated image file, so
# ext4 / xfs / btrfs can be compared on the same disk with the same overhead.
#
#   sudo ./mkvol.sh up   <ext4|xfs|btrfs> [size, default 48G]   -> /mnt/fsbench-<fs>
#   sudo ./mkvol.sh down <ext4|xfs|btrfs>
set -eu

action=${1:?up|down}
fs=${2:?ext4|xfs|btrfs}
size=${3:-48G}
owner=${SUDO_USER:-$(id -un)}
img_dir=${IMG_DIR:-$(getent passwd "$owner" | cut -d: -f6)/fs-bench-data/img}
img=$img_dir/$fs.img
mnt=/mnt/fsbench-$fs

case $action in
up)
  mkdir -p "$img_dir" "$mnt"
  rm -f "$img"
  touch "$img"
  # On a btrfs host, disable CoW and compression for the image so the host
  # filesystem does not add its own overhead underneath the tested one.
  chattr +C "$img" 2>/dev/null || true
  fallocate -l "$size" "$img"
  dev=$(losetup --find --show --direct-io=on "$img")
  case $fs in
  ext4) mkfs.ext4 -q -F -E lazy_itable_init=0,lazy_journal_init=0 "$dev" ;;
  xfs) mkfs.xfs -q -f "$dev" ;;
  btrfs) mkfs.btrfs -q -f "$dev" ;;
  *) echo "unsupported fs: $fs" >&2; losetup -d "$dev"; exit 1 ;;
  esac
  mount "$dev" "$mnt"
  chown "$owner:" "$mnt"
  echo "$fs on $dev mounted at $mnt"
  ;;
down)
  umount "$mnt" 2>/dev/null || true
  for dev in $(losetup -j "$img" | cut -d: -f1); do losetup -d "$dev"; done
  rm -f "$img"
  rmdir "$mnt" 2>/dev/null || true
  echo "removed $fs volume"
  ;;
esac

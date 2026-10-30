#!/usr/bin/env bash
# Linux: home directory, then ext4 / xfs / btrfs test volumes, strictly one after another.
#   ./linux-all.sh [label]        VOLUMES="ext4" to pick volumes, VOLUMES="" for home only
# MKVOL=/path runs that copy of mkvol.sh instead, e.g. a root-owned one with a NOPASSWD sudo rule
# for unattended runs.
set -eu
cd "$(dirname "$0")"
label=${1:-$(hostname -s)}
volumes=${VOLUMES-ext4 xfs btrfs}
mkvol=${MKVOL:-./mkvol.sh}

if [ -n "$volumes" ] && ! sudo -n -l "$mkvol" >/dev/null 2>&1; then
  sudo -v
  while sleep 60; do sudo -n true; done 2>/dev/null &
  keepalive=$!
  trap 'kill $keepalive' EXIT
fi

./fsbench.sh "$HOME/fsbench-data/home" "$label"
for fs in $volumes; do
  sudo "$mkvol" up "$fs"
  ./fsbench.sh "/mnt/fsbench-$fs" "$label"
  sudo "$mkvol" down "$fs"
done

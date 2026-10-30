#!/usr/bin/env bash
# Linux: home directory, then ext4 / xfs / btrfs test volumes, strictly one after another.
#   ./linux-all.sh [label]        VOLUMES="ext4" to pick volumes, VOLUMES="" for home only
set -eu
cd "$(dirname "$0")"
label=${1:-$(hostname -s)}
volumes=${VOLUMES-ext4 xfs btrfs}

if [ -n "$volumes" ]; then
  sudo -v
  while sleep 60; do sudo -n true; done 2>/dev/null &
  keepalive=$!
  trap 'kill $keepalive' EXIT
fi

./fsbench.sh "$HOME/fsbench-data/home" "$label"
for fs in $volumes; do
  sudo ./mkvol.sh up "$fs"
  ./fsbench.sh "/mnt/fsbench-$fs" "$label"
  sudo ./mkvol.sh down "$fs"
done

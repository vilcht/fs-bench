#!/usr/bin/env bash
# Linux: home directory, then ext4 / xfs / btrfs test volumes, strictly one after another.
#   ./linux-all.sh [label]
set -eu
cd "$(dirname "$0")"
label=${1:-$(hostname -s)}
sudo -v
while sleep 60; do sudo -n true; done 2>/dev/null &
keepalive=$!
trap 'kill $keepalive' EXIT

./fsbench.sh "$HOME/fs-bench-data/home" "$label"
for fs in ext4 xfs btrfs; do
  sudo ./mkvol.sh up "$fs"
  ./fsbench.sh "/mnt/fsbench-$fs" "$label"
  sudo ./mkvol.sh down "$fs"
done

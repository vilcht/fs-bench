#!/usr/bin/env bash
# One-liner entry point:
#   curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash
#
# Fetches the benchmark, uses a pinned Node 22 (pnpm comes from the repo's packageManager via
# corepack), runs every configuration for this OS, and packs the results into one file.
# Env: LABEL, FSBENCH_HOME (default ~/fs-bench), KEEP_DATA=1, plus fsbench.sh knobs (NS, REPS, METHODS)
# and linux-all.sh's VOLUMES.

main() {
  set -eu
  NODE_VERSION=22.22.3
  DIR=${FSBENCH_HOME:-$HOME/fs-bench}
  OS=$(uname -s)

  [ "$(id -u)" != 0 ] || { echo "run as your normal user, not root" >&2; exit 1; }
  if [ "$OS" = Darwin ] && ! xcode-select -p >/dev/null 2>&1; then
    echo "git is missing: run 'xcode-select --install', then rerun this command" >&2
    exit 1
  fi
  command -v git >/dev/null || { echo "git is missing" >&2; exit 1; }

  echo "== fetching fs-bench into $DIR"
  if [ -d "$DIR/.git" ]; then
    git -C "$DIR" pull -q --ff-only
  else
    git clone -q --depth 1 https://github.com/vilcht/fs-bench.git "$DIR"
  fi
  cd "$DIR"

  case "$OS-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Darwin-x86_64) platform=darwin-x64 ;;
  Linux-x86_64) platform=linux-x64 ;;
  Linux-aarch64) platform=linux-arm64 ;;
  *) echo "unsupported platform $OS $(uname -m)" >&2; exit 1 ;;
  esac
  node_dir=$DIR/.tools/node-v$NODE_VERSION-$platform
  if [ ! -x "$node_dir/bin/node" ]; then
    echo "== downloading Node $NODE_VERSION"
    mkdir -p .tools
    tarball=node-v$NODE_VERSION-$platform.tar.gz
    curl -fsSL -o ".tools/$tarball" "https://nodejs.org/dist/v$NODE_VERSION/$tarball"
    expected=$(curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" | awk -v f="$tarball" '$2 == f { print $1 }')
    actual=$( (sha256sum ".tools/$tarball" 2>/dev/null || shasum -a 256 ".tools/$tarball") | awk '{ print $1 }')
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo "Node checksum mismatch" >&2; exit 1; }
    tar -xzf ".tools/$tarball" -C .tools
    rm ".tools/$tarball"
  fi
  mkdir -p .tools/bin
  export PATH=$DIR/.tools/bin:$node_dir/bin:$PATH
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  corepack enable --install-directory "$DIR/.tools/bin" pnpm

  if [ -z "${LABEL:-}" ]; then
    if [ "$OS" = Darwin ]; then
      cpu=$(sysctl -n machdep.cpu.brand_string)
    else
      cpu=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2-)
    fi
    LABEL=$(echo "$cpu" | sed -E 's/\((R|TM)\)//g; s/(Processor|CPU|[0-9]+-Core)//g; s/@.*//' |
      tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed -E 's/^-+|-+$//g')
  fi
  export LABEL

  marker=$DIR/.tools/started
  touch "$marker"
  echo "== running as label '$LABEL'. Takes about an hour; keep the machine plugged in and idle."
  if [ "$OS" = Darwin ]; then
    # caffeinate keeps the Mac awake; *.noindex directories are skipped by Spotlight.
    caffeinate -dimsu ./fsbench.sh "$HOME/fsbench-data/apfs" "$LABEL"
    caffeinate -dimsu ./fsbench.sh "$HOME/fsbench-data.noindex/apfs" "$LABEL"
    data="$HOME/fsbench-data $HOME/fsbench-data.noindex"
  else
    if command -v systemd-inhibit >/dev/null; then
      systemd-inhibit --what=idle:sleep --why=fs-bench ./linux-all.sh "$LABEL"
    else
      ./linux-all.sh "$LABEL"
    fi
    data="$HOME/fsbench-data"
  fi

  runs=$(cd results && find . -mindepth 1 -maxdepth 1 -type d -newer "$marker" | sed 's|^\./||')
  archive=$HOME/fsbench-results-$LABEL-$(date +%Y%m%d-%H%M).tar.gz
  tar -czf "$archive" -C results $runs
  if [ "${KEEP_DATA:-0}" != 1 ]; then
    for d in $data; do chmod -R u+w "$d" 2>/dev/null; rm -rf "$d"; done
  fi

  echo
  python3 summarize.py 2>/dev/null | head -60 || true
  echo
  echo "Done. Send this file back: $archive"
}

# Everything runs inside main with stdin detached, so `curl | bash` can't feed
# the rest of this script to a child process that reads stdin.
main "$@" </dev/null

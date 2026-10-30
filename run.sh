#!/usr/bin/env bash
# One-liner entry point (macOS / Linux / WSL terminal, or Git Bash on Windows):
#   curl -fsSL https://raw.githubusercontent.com/vilcht/fs-bench/main/run.sh | bash
#
# Fetches the benchmark, uses a pinned Node 22 (pnpm comes from the repo's packageManager via
# corepack), runs every configuration for this OS, and packs the results into one file.
# Env: LABEL, FSBENCH_HOME (default ~/fs-bench), KEEP_DATA=1, DEV_DRIVE=/d (Windows Dev Drive, Git Bash path),
# plus fsbench.sh knobs (NS, REPS, METHODS) and linux-all.sh's VOLUMES.

main() {
  set -eu
  export LC_ALL=C
  NODE_VERSION=22.22.3
  DIR=${FSBENCH_HOME:-$HOME/fs-bench}
  OS=$(uname -s)
  case "$OS" in MINGW* | MSYS* | CYGWIN*) OS=Windows ;; esac
  WSL=
  [ "$OS" = Linux ] && grep -qi microsoft /proc/version 2>/dev/null && WSL=1

  [ "$OS" = Windows ] || [ "$(id -u)" != 0 ] || { echo "run as your normal user, not root" >&2; exit 1; }
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
  Darwin-arm64) platform=darwin-arm64 ext=tar.gz ;;
  Darwin-x86_64) platform=darwin-x64 ext=tar.gz ;;
  Linux-x86_64) platform=linux-x64 ext=tar.gz ;;
  Linux-aarch64) platform=linux-arm64 ext=tar.gz ;;
  Windows-x86_64) platform=win-x64 ext=zip ;;
  Windows-aarch64 | Windows-arm64) platform=win-arm64 ext=zip ;;
  *) echo "unsupported platform $OS $(uname -m)" >&2; exit 1 ;;
  esac
  node_dir=$DIR/.tools/node-v$NODE_VERSION-$platform
  node_bin=$node_dir/bin
  [ "$OS" = Windows ] && node_bin=$node_dir
  if [ ! -e "$node_bin/node" ] && [ ! -e "$node_bin/node.exe" ]; then
    echo "== downloading Node $NODE_VERSION"
    mkdir -p .tools
    archive_name=node-v$NODE_VERSION-$platform.$ext
    curl -fsSL -o ".tools/$archive_name" "https://nodejs.org/dist/v$NODE_VERSION/$archive_name"
    expected=$(curl -fsSL "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt" | awk -v f="$archive_name" '$2 == f { print $1 }')
    actual=$( (sha256sum ".tools/$archive_name" 2>/dev/null || shasum -a 256 ".tools/$archive_name") | awk '{ print $1 }')
    [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo "Node checksum mismatch" >&2; exit 1; }
    if [ "$ext" = zip ]; then
      # Windows 10+ ships bsdtar, which reads zip archives.
      (cd .tools && "$(cygpath "$SYSTEMROOT")/System32/tar.exe" -xf "$archive_name")
    else
      tar -xzf ".tools/$archive_name" -C .tools
    fi
    rm ".tools/$archive_name"
  fi
  mkdir -p .tools/bin
  export PATH=$DIR/.tools/bin:$node_bin:$PATH
  export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
  corepack enable --install-directory "$DIR/.tools/bin" pnpm

  if [ -z "${LABEL:-}" ]; then
    case "$OS" in
    Darwin) cpu=$(sysctl -n machdep.cpu.brand_string) ;;
    Windows) cpu=$(powershell.exe -NoProfile -Command '(Get-CimInstance Win32_Processor).Name' | tr -d '\r') ;;
    *) cpu=$(grep -m1 'model name' /proc/cpuinfo | cut -d: -f2-) ;;
    esac
    LABEL=$(echo "$cpu" | sed -E 's/\((R|TM)\)//g; s/(Processor|CPU|[0-9]+-Core)//g; s/@.*//' |
      tr 'A-Z' 'a-z' | tr -cs 'a-z0-9' '-' | sed -E 's/^-+|-+$//g')
    case "$OS" in
    Windows) LABEL=$LABEL-windows ;;
    Darwin) LABEL=$LABEL-macos ;;
    *) if [ -n "$WSL" ]; then LABEL=$LABEL-wsl; else LABEL=$LABEL-linux; fi ;;
    esac
  fi
  export LABEL

  marker=$DIR/.tools/started
  touch "$marker"
  echo "== running as label '$LABEL'. Takes about an hour; keep the machine plugged in and idle."
  case "$OS" in
  Darwin)
    # caffeinate keeps the Mac awake; *.noindex directories are skipped by Spotlight.
    caffeinate -dimsu ./fsbench.sh "$HOME/fsbench-data/apfs" "$LABEL"
    caffeinate -dimsu ./fsbench.sh "$HOME/fsbench-data.noindex/apfs" "$LABEL"
    data="$HOME/fsbench-data $HOME/fsbench-data.noindex"
    ;;
  Windows)
    echo "   (set the power plan so the PC doesn't sleep during the run)"
    ./fsbench.sh "$HOME/fsbench-data/home" "$LABEL"
    data="$HOME/fsbench-data"
    if [ -n "${DEV_DRIVE:-}" ]; then
      ./fsbench.sh "$DEV_DRIVE/fsbench-data" "$LABEL"
      data="$data $DEV_DRIVE/fsbench-data"
    fi
    ;;
  *)
    # WSL has no loop-mounted test volumes; its home is already ext4 on a virtual disk.
    [ -n "$WSL" ] && export VOLUMES=${VOLUMES-}
    if command -v systemd-inhibit >/dev/null && systemd-inhibit --what=idle true 2>/dev/null; then
      systemd-inhibit --what=idle:sleep --why=fs-bench ./linux-all.sh "$LABEL"
    else
      ./linux-all.sh "$LABEL"
    fi
    data="$HOME/fsbench-data"
    ;;
  esac

  runs=$(cd results && find . -mindepth 1 -maxdepth 1 -type d -newer "$marker" | sed 's|^\./||')
  archive=$HOME/fsbench-results-$LABEL-$(date +%Y%m%d-%H%M).tar.gz
  tar -czf "$archive" -C results $runs
  if [ "${KEEP_DATA:-0}" != 1 ]; then
    for d in $data; do chmod -R u+w "$d" 2>/dev/null || true; rm -rf "$d"; done
  fi

  echo
  python3 summarize.py 2>/dev/null | head -60 || true
  echo
  echo "Done. Send this file back: $archive"
}

# Everything runs inside main with stdin detached, so `curl | bash` can't feed
# the rest of this script to a child process that reads stdin.
main "$@" </dev/null

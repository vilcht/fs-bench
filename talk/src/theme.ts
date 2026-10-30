// Filesystem stack colors (dark categorical palette, validated with the dataviz skill's validator).
// Color follows the stack, never rank. On the title slide they are also the colors of the files
// the write heads lay down, so the decoration previews the cast.
export const FAMILY_COLOR: Record<string, string> = {
  ext4: '#3987e5',
  apfs: '#d95926',
  xfs: '#199e70',
  ntfs: '#c98500',
  refs: '#d55181',
  wsl: '#1a9c1a',
  btrfs: '#9085e9',
}

export const familyColor = (family: string) => FAMILY_COLOR[family] ?? '#8d8f99'

export const INK = {
  primary: '#f3f2ee',
  secondary: '#c9c8c3',
  muted: '#8d8f99',
  grid: '#262833',
  axis: '#3a3d4a',
  void: '#121318',
  empty: '#191b22',
  good: '#0ca30c',
  critical: '#d03b3b',
}

export const fmtSeconds = (s: number) => (s >= 100 ? `${Math.round(s)} s` : s >= 10 ? `${s.toFixed(1)} s` : `${s.toFixed(2)} s`)
export const fmtTimes = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}×`

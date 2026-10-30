// Dark categorical palette (validated with the dataviz skill's validator, dark mode, adjacent
// pairs). Color follows the filesystem stack, never rank.
export const FAMILY_COLOR: Record<string, string> = {
  ext4: '#3987e5',
  apfs: '#d95926',
  xfs: '#199e70',
  ntfs: '#c98500',
  refs: '#d55181',
  wsl: '#008300',
  btrfs: '#9085e9',
}

export const familyColor = (family: string) => FAMILY_COLOR[family] ?? '#898781'

export const INK = {
  primary: '#f0efec',
  secondary: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  surface: '#1a1a19',
  page: '#0d0d0d',
  good: '#0ca30c',
  critical: '#d03b3b',
}

export const fmtSeconds = (s: number) => (s >= 100 ? `${Math.round(s)} s` : s >= 10 ? `${s.toFixed(1)} s` : `${s.toFixed(2)} s`)
export const fmtTimes = (x: number) => `${x >= 10 ? x.toFixed(0) : x.toFixed(1)}×`

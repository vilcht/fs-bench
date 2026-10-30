import { type Config, cfg, phaseTime, setupTime } from './data'

/**
 * Every vote is a "higher / lower" round: one result is known (`base`), the audience guesses how
 * the next machine (`target`) compares, as a multiple of the base time. 1× = same, 0.5× = twice as
 * fast, 3× = three times as long.
 */
export interface Poll {
  id: string
  base: string
  target: string
  metric: Metric
  /** Short framing shown above the two machines. */
  prompt: string
  min: number
  max: number
  /** target / base */
  answer: number
  sources: string[]
}

export type Metric = 'setup' | 'remove'

export const METRIC_LABEL: Record<Metric, string> = {
  setup: '16 agents: checkout + install',
  remove: '16 agents: delete worktrees',
}

export function metricValue(c: Config, metric: Metric): number {
  return metric === 'setup' ? setupTime(c, 16) : phaseTime(c, 'remove', 16)
}

const MIN_STEPS = [0.1, 0.15, 0.2, 0.25, 0.33, 0.4, 0.5]
const MAX_STEPS = [3, 4, 5, 6, 8, 10, 15, 20, 30]

function round(id: string, base: string, target: string, metric: Metric, prompt: string): Poll {
  const answer = metricValue(cfg(target), metric) / metricValue(cfg(base), metric)
  // Default slider is 0.5×–3×; widen it only when the answer would sit at (or past) an end.
  const min = Math.min(0.5, [...MIN_STEPS].reverse().find((m) => m <= answer / 1.4) ?? MIN_STEPS[0])
  const max = Math.max(3, MAX_STEPS.find((m) => m >= answer * 1.4) ?? MAX_STEPS[MAX_STEPS.length - 1])
  return { id, base, target, metric, prompt, min, max, answer, sources: [base, target] }
}

export const POLLS: Poll[] = [
  round('huawei', 'desktop:ext4', 'huawei:home-ext4', 'setup', 'A laptop, also on Linux'),
  round('macbook', 'huawei:home-ext4', 'macbook:apfs', 'setup', 'Enter the Mac'),
  round('spotlight', 'macbook:apfs', 'macbook:apfs-noindex', 'setup', 'Same MacBook, worktrees in a folder Spotlight skips'),
  round('windows', 'desktop:ext4', 'desktop-win:ntfs', 'setup', 'Same desktop PC, booted into Windows'),
  round('devdrive', 'desktop-win:ntfs', 'desktop-win:devdrive', 'setup', 'Same Windows, repo on a Dev Drive'),
  round('wsl', 'desktop-win:devdrive', 'desktop-wsl:home-ext4', 'setup', 'Same Windows, repo inside WSL2'),
  round('delete', 'desktop:ext4', 'macbook:apfs', 'remove', 'Cleaning up: delete all 16 worktrees'),
]

export function poll(id: string): Poll {
  const p = POLLS.find((p) => p.id === id)
  if (!p) throw new Error('Unknown poll', { cause: { id } })
  return p
}

export const MAX_POINTS = 1000
/** A guess this many times off (either way) scores zero. */
export const ZERO_AT = 2.5

/** Full points at the exact ratio, linear in log distance down to zero at 2.5× off. */
export function score(p: Poll, value: number): number {
  if (!(value > 0)) return 0
  const miss = Math.abs(Math.log(value / p.answer)) / Math.log(ZERO_AT)
  return Math.round(MAX_POINTS * Math.max(0, 1 - miss))
}

/** "2.1× as long", "0.6× · 1.7× faster", "same". */
export function describeRatio(x: number): string {
  if (Math.abs(Math.log(x)) < 0.03) return '1.0× · the same'
  if (x > 1) return x >= 1.95 ? `${fmtRatio(x)} as long` : `${fmtRatio(x)} · ${Math.round((x - 1) * 100)}% slower`
  return `${fmtRatio(x)} · ${fmtRatio(1 / x)} faster`
}

export function fmtRatio(x: number): string {
  return `${x >= 10 ? x.toFixed(0) : x.toFixed(x < 1 ? 2 : 1)}×`
}

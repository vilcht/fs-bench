import raw from './data/results.json'

export type Phase = 'worktree_add' | 'install' | 'git_status' | 'remove'
/** [agent, start s, end s, ok], relative to the race's start (remove: its own batch start). */
export type RaceAgent = [number, number, number, boolean]

export interface RacePhase {
  start: number
  end: number
  agents: RaceAgent[]
}

export interface Config {
  id: string
  machine: string
  machineName: string
  machineDetail: string
  stack: string
  stackName: string
  family: string
  name: string
  mock: boolean
  raceMock: boolean
  source: string | null
  cpuModel: string | null
  cores: string | null
  ns: number[]
  phases: Record<Phase, Record<string, number>>
  cpu: Record<string, number>
  retries: Record<string, number>
  failures: Record<string, number>
  race: { n: number; rep: number; phases: Partial<Record<Phase, RacePhase>> }
  /** Median resource use per phase at the highest agent count. */
  resources: Partial<Record<Phase, Resources>>
  resourcesMock?: boolean
}

export interface Resources {
  /** Machine-wide CPU busy, % of all cores. */
  busy_pct?: number
  /** Kernel share of the benchmark processes' CPU time. */
  kernel_pct?: number
  cpu_s?: number
  /** Peak RAM above the level before the phase. */
  mem_mb?: number
  /** Disk read + written, until the post-phase sync. */
  disk_mb?: number
}

export const configs = raw.configs as unknown as Config[]

export function cfg(id: string): Config {
  const c = configs.find((c) => c.id === id)
  if (!c) throw new Error('Unknown config', { cause: { id } })
  return c
}

export function phaseTime(c: Config, phase: Phase, n: number): number {
  return c.phases[phase][String(n)] ?? NaN
}

/** Wall time for n agents to each get a ready worktree: checkout + install. */
export function setupTime(c: Config, n: number): number {
  return phaseTime(c, 'worktree_add', n) + phaseTime(c, 'install', n)
}

export const NS = [1, 2, 4, 8, 16]

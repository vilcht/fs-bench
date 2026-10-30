import { cfg, phaseTime, setupTime } from './data'

export interface ChoiceOption {
  id: string
  label: string
  detail?: string
}

interface PollBase {
  id: string
  question: string
  /** Config ids whose data decides the answer (badged when mock). */
  sources: string[]
}

export interface ChoicePoll extends PollBase {
  kind: 'choice'
  options: ChoiceOption[]
  answer: string
}

export interface NumberPoll extends PollBase {
  kind: 'number'
  unit: 's' | '×'
  min: number
  max: number
  answer: number
}

export type Poll = ChoicePoll | NumberPoll

function fastest(question: string, id: string, n: number, options: { id: string; label: string }[]): ChoicePoll {
  const answer = options.reduce((best, o) => (setupTime(cfg(o.id), n) < setupTime(cfg(best.id), n) ? o : best))
  return {
    id,
    kind: 'choice',
    question,
    options: options.map((o) => ({ ...o, detail: cfg(o.id).machineDetail })),
    answer: answer.id,
    sources: options.map((o) => o.id),
  }
}

const RACE = [
  { id: 'macbook:apfs', label: 'MacBook · macOS' },
  { id: 'desktop:ext4', label: 'Desktop · Linux' },
  { id: 'huawei:home-ext4', label: 'Huawei laptop · Linux' },
  { id: 'desktop-win:ntfs', label: 'Desktop · Windows' },
]

const SAME_PC = [
  { id: 'desktop-win:ntfs', label: 'Windows, NTFS + Defender' },
  { id: 'desktop-win:devdrive', label: 'Windows, Dev Drive' },
  { id: 'desktop-wsl:home-ext4', label: 'WSL2 on Windows' },
  { id: 'desktop:ext4', label: 'Linux, ext4' },
]

export const POLLS: Poll[] = [
  fastest('One agent: check out the repo and install. Who is ready first?', 'one-agent', 1, RACE),
  fastest('Sixteen agents at once. Who has all 16 ready first?', 'sixteen', 16, RACE),
  {
    id: 'mac-remove',
    kind: 'number',
    question: 'The MacBook deletes 8 worktrees in the time shown. How long for 16 at once?',
    unit: 's',
    min: 1,
    max: 300,
    answer: phaseTime(cfg('macbook:apfs'), 'remove', 16),
    sources: ['macbook:apfs'],
  },
  {
    id: 'spotlight',
    kind: 'number',
    question: 'Hide the worktrees from Spotlight. How many times faster do 16 agents get set up on the MacBook?',
    unit: '×',
    min: 0.5,
    max: 10,
    answer: setupTime(cfg('macbook:apfs'), 16) / setupTime(cfg('macbook:apfs-noindex'), 16),
    sources: ['macbook:apfs', 'macbook:apfs-noindex'],
  },
  fastest('Same desktop PC, 16 agents. Which setup is ready first?', 'same-pc', 16, SAME_PC),
]

export function poll(id: string): Poll {
  const p = POLLS.find((p) => p.id === id)
  if (!p) throw new Error('Unknown poll', { cause: { id } })
  return p
}

export const MAX_POINTS = 1000

/** Choice: all or nothing. Number: full points at the exact answer, zero once 4× off either way. */
export function score(p: Poll, value: string | number): number {
  if (p.kind === 'choice') return value === p.answer ? MAX_POINTS : 0
  const guess = Number(value)
  if (!(guess > 0) || !(p.answer > 0)) return 0
  const miss = Math.abs(Math.log(guess / p.answer)) / Math.log(4)
  return Math.round(MAX_POINTS * Math.max(0, 1 - miss))
}

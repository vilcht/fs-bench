export type PollStatus = 'closed' | 'open' | 'revealed'

export interface PollView {
  status: PollStatus
  votes: number
  /** Only once revealed: choice id -> count, or every numeric guess. */
  tally?: Record<string, number>
  guesses?: number[]
}

export interface Me {
  id: string
  /** Public id of this player's cursor (the player id itself is a secret). */
  cursorId: string | null
  name: string | null
  score: number
  rank: number | null
  votes: Record<string, string | number>
  points: Record<string, number>
}

export interface RoomState {
  slide: number
  step: number
  players: number
  polls: Record<string, PollView>
  leaderboard: { name: string; score: number }[]
  me?: Me
}

export type ClientMessage =
  | { t: 'join'; name: string }
  | { t: 'vote'; pollId: string; value: string | number }
  /** Pointer position on the slide, 0..1 in both axes; x < 0 means the pointer left. */
  | { t: 'cursor'; x: number; y: number }
  // presenter only
  | { t: 'goto'; slide: number; step: number; open?: string; reveal?: string }
  | { t: 'reset' }

export interface Cursor {
  id: string
  name: string
  x: number
  y: number
}

export type ServerMessage =
  | { t: 'state'; state: RoomState }
  | { t: 'cursors'; cursors: Cursor[] }
  | { t: 'error'; message: string }

export type Role = 'audience' | 'presenter' | 'notes'

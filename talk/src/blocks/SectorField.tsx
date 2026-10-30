import { useEffect, useRef } from 'react'
import { STAGE_H, STAGE_W } from '../Stage'
import { FAMILY_COLOR } from '../theme'
import { layoutText } from './font'

export const PITCH = 20
const BLOCK = 17
const COLS = STAGE_W / PITCH
const ROWS = STAGE_H / PITCH
const HEADS = 16
const SPEED = 62 // cells per second per head
const RES = 2 // canvas pixels per stage pixel

const VOID = '#121318'
const EMPTY = '#191b22'
const INK = '#f3f2ee'
const HEAD_COLORS = Object.values(FAMILY_COLOR)

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

interface Cell {
  color: string
  alpha: number
}

/**
 * Full-bleed sector map. Sixteen write heads sweep their rows, writing "files" in the filesystem
 * colors; where a head crosses the title's glyph cells it writes them in ink, so the title
 * appears as the disk fills. Afterwards the disk keeps a slow churn going.
 */
export function SectorField({ title, col, row }: { title: string; col: number; row: number }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const random = rng(16)
    const layout = layoutText(title)
    const glyph = new Set(layout.cells.map(([c, r]) => (r + row) * COLS + c + col))
    // Nothing but the title gets written inside its box (plus a one-cell margin), so it reads.
    const inTitle = (i: number) => {
      const c = i % COLS
      const r = Math.floor(i / COLS)
      return c >= col - 1 && c <= col + layout.cols && r >= row - 1 && r <= row + layout.rows
    }
    const cells: (Cell | null)[] = new Array(COLS * ROWS).fill(null)

    // Head i owns rows i, i + 16, i + 32 and writes them left to right as runs of files and gaps.
    const heads = Array.from({ length: HEADS }, (_, i) => {
      const rows: number[] = []
      for (let r = i; r < ROWS; r += HEADS) rows.push(r)
      return {
        rows,
        pos: -random() * 14,
        speed: SPEED * (0.8 + random() * 0.45),
        color: HEAD_COLORS[i % HEAD_COLORS.length],
        run: 0,
        gap: 0,
        alpha: 0.4,
      }
    })

    const draw = (headCells: Set<number>) => {
      ctx.setTransform(RES, 0, 0, RES, 0, 0)
      ctx.fillStyle = VOID
      ctx.fillRect(0, 0, STAGE_W, STAGE_H)
      for (let i = 0; i < cells.length; i++) {
        const x = (i % COLS) * PITCH
        const y = Math.floor(i / COLS) * PITCH
        const cell = cells[i]
        if (headCells.has(i)) {
          ctx.globalAlpha = 1
          ctx.fillStyle = INK
        } else if (cell) {
          ctx.globalAlpha = cell.alpha
          ctx.fillStyle = cell.color
        } else {
          ctx.globalAlpha = 1
          ctx.fillStyle = EMPTY
        }
        ctx.fillRect(x, y, BLOCK, BLOCK)
      }
      ctx.globalAlpha = 1
    }

    const write = (head: (typeof heads)[number], index: number) => {
      if (glyph.has(index)) {
        cells[index] = { color: INK, alpha: 1 }
        return
      }
      if (inTitle(index)) return
      if (head.run <= 0 && head.gap <= 0) {
        head.run = 2 + Math.floor(random() * 11)
        head.gap = Math.floor(random() * 5)
        head.alpha = 0.18 + random() * 0.3
      }
      if (head.run > 0) {
        cells[index] = { color: head.color, alpha: head.alpha }
        head.run--
      } else {
        head.gap--
      }
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const total = (h: (typeof heads)[number]) => h.rows.length * COLS
    if (reduced) {
      for (const h of heads) for (let p = 0; p < total(h); p++) write(h, h.rows[Math.floor(p / COLS)] * COLS + (p % COLS))
      draw(new Set())
      return
    }

    let raf = 0
    let last = performance.now()
    let churnAt = 0
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const headCells = new Set<number>()
      let writing = false
      for (const h of heads) {
        const end = total(h)
        if (h.pos >= end) continue
        writing = true
        const from = Math.max(0, Math.floor(h.pos))
        h.pos += h.speed * dt
        const to = Math.min(end, Math.floor(h.pos))
        for (let p = from; p < to; p++) write(h, h.rows[Math.floor(p / COLS)] * COLS + (p % COLS))
        if (h.pos >= 0 && h.pos < end) headCells.add(h.rows[Math.floor(h.pos / COLS)] * COLS + (Math.floor(h.pos) % COLS))
      }
      // Once written, keep the disk busy: small runs get rewritten or freed now and then.
      if (!writing && now > churnAt) {
        churnAt = now + 70 + random() * 120
        const start = Math.floor(random() * cells.length)
        const len = 1 + Math.floor(random() * 5)
        const color = HEAD_COLORS[Math.floor(random() * HEAD_COLORS.length)]
        const free = random() < 0.35
        const alpha = 0.18 + random() * 0.3
        for (let i = start; i < Math.min(cells.length, start + len); i++) {
          if (inTitle(i)) continue
          cells[i] = free ? null : { color, alpha }
          headCells.add(i)
        }
      }
      draw(headCells)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [title, col, row])

  return <canvas ref={canvas} className="sector-field" width={STAGE_W * RES} height={STAGE_H * RES} aria-hidden="true" />
}

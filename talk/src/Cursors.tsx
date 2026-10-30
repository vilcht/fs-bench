import { type PointerEvent, type RefObject, useCallback, useEffect, useRef } from 'react'
import type { ClientMessage, Cursor } from '../shared/protocol'
import { STAGE_H, STAGE_W } from './Stage'
import { FAMILY_COLOR, INK } from './theme'

// Pixel arrow: O = outline, X = fill in the player's color.
const ARROW = ['O', 'OO', 'OXO', 'OXXO', 'OXXXO', 'OXXXXO', 'OXXXXXO', 'OXXOOOO', 'OXO', 'OO', 'O']
const PX = 3
const COLORS = Object.values(FAMILY_COLOR)

function colorFor(id: string) {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return COLORS[h % COLORS.length]
}

/** Everyone's pointer on the slide, in stage coordinates, gliding between the batched updates. */
export function Cursors({ cursors, exclude }: { cursors: Cursor[]; exclude?: string | null }) {
  return (
    <div className="cursors" aria-hidden="true">
      {cursors
        .filter((c) => c.id !== exclude)
        .map((c) => {
          const color = colorFor(c.id)
          return (
            <div key={c.id} className="cursor" style={{ transform: `translate(${c.x * STAGE_W}px, ${c.y * STAGE_H}px)` }}>
              <svg width={7 * PX} height={ARROW.length * PX}>
                {ARROW.flatMap((row, r) =>
                  [...row].map((ch, x) =>
                    ch === ' ' ? null : <rect key={`${r}-${x}`} x={x * PX} y={r * PX} width={PX} height={PX} fill={ch === 'X' ? color : INK.void} />,
                  ),
                )}
              </svg>
              <span className={c.x > 0.85 ? 'cursor-name flip' : 'cursor-name'} style={{ background: color }}>
                {c.name}
              </span>
            </div>
          )
        })}
    </div>
  )
}

const SEND_EVERY_MS = 80

/**
 * Reports this viewer's pointer relative to the slide inside `area`, at most every 80 ms.
 * Returns pointer handlers for the area.
 */
export function useCursorReporter(area: RefObject<HTMLElement | null>, send: (m: ClientMessage) => void) {
  const latest = useRef<{ x: number; y: number } | null>(null)
  const sent = useRef<string>('')

  useEffect(() => {
    const timer = setInterval(() => {
      const pos = latest.current ?? { x: -1, y: -1 }
      const key = `${pos.x.toFixed(4)},${pos.y.toFixed(4)}`
      if (key === sent.current) return
      sent.current = key
      send({ t: 'cursor', x: pos.x, y: pos.y })
    }, SEND_EVERY_MS)
    return () => clearInterval(timer)
  }, [send])

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const stage = area.current?.querySelector('.stage')
      if (!stage) return
      const r = stage.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width
      const y = (e.clientY - r.top) / r.height
      latest.current = x >= 0 && x <= 1 && y >= 0 && y <= 1 ? { x, y } : null
    },
    [area],
  )
  const onPointerLeave = useCallback(() => {
    latest.current = null
  }, [])
  return { onPointerMove, onPointerLeave }
}

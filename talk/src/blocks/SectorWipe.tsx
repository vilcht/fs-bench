import { useEffect, useRef } from 'react'
import { STAGE_H, STAGE_W } from '../Stage'

const PITCH = 20
const COLS = STAGE_W / PITCH
const ROWS = STAGE_H / PITCH
const DURATION = 380
const FLASH = 60

/**
 * Slide transition: the incoming slide is covered by sectors that each flash (a write) and then
 * clear, in random order. Replays whenever `trigger` changes.
 */
export function SectorWipe({ trigger }: { trigger: string }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const first = useRef(true)

  useEffect(() => {
    const el = canvas.current
    const ctx = el?.getContext('2d')
    if (!el || !ctx) return
    // No wipe on first paint, or when the user asked for less motion.
    if (first.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      first.current = false
      ctx.clearRect(0, 0, el.width, el.height)
      return
    }
    const times = Array.from({ length: COLS * ROWS }, () => Math.random() * (DURATION - FLASH))
    let raf = 0
    const t0 = performance.now()
    const frame = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, el.width, el.height)
      for (let i = 0; i < times.length; i++) {
        if (t >= times[i] + FLASH) continue
        ctx.fillStyle = t < times[i] ? '#121318' : 'rgba(243, 242, 238, 0.35)'
        ctx.fillRect((i % COLS) * PITCH, Math.floor(i / COLS) * PITCH, PITCH, PITCH)
      }
      if (t < DURATION) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [trigger])

  return <canvas ref={canvas} className="sector-wipe" width={STAGE_W} height={STAGE_H} aria-hidden="true" />
}

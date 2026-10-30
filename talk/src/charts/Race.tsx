import { useEffect, useRef, useState } from 'react'
import type { Config, Phase } from '../../shared/data'
import { INK, familyColor, fmtSeconds } from '../theme'

const LABEL_W = 300
const FINISH_W = 190
const CELL = 5
const PITCH = 6
const LANE_GAP = 26
const TOP = 40
const BOTTOM = 34
/** Replays are compressed so the slowest lane finishes in about this many seconds. */
const TARGET_DURATION = 12
const RES = 2

/**
 * Replays each config's recorded per-agent timeline as a sector map: one row of cells per agent,
 * one column per slice of time. A cell is written once the replay clock passes it and the agent
 * was busy then; checkout at half strength, install solid. One time scale for every lane, so the
 * race is fair.
 */
export function Race({
  configs,
  phases,
  width,
  playing,
  labels,
}: {
  configs: Config[]
  phases: Phase[]
  width: number
  playing: boolean
  labels?: Record<string, string>
}) {
  const lanes = configs.map((c) => {
    const ph = phases.map((p) => c.race.phases[p]).filter((x) => x !== undefined)
    const offset = ph[0]?.start ?? 0
    const end = Math.max(...ph.map((p) => p.end)) - offset
    return { c, ph, offset, end, n: c.race.n }
  })
  const maxEnd = Math.max(...lanes.map((l) => l.end))
  const speed = Math.max(1, maxEnd / TARGET_DURATION)
  const plotW = width - LABEL_W - FINISH_W
  const cols = Math.floor(plotW / PITCH)
  const slice = maxEnd / cols
  const laneH = (n: number) => n * PITCH
  let y = TOP
  const placed = lanes.map((l) => {
    const top = y
    y += laneH(l.n) + LANE_GAP
    return { ...l, top }
  })
  const height = y - LANE_GAP + BOTTOM
  const finishOrder = [...lanes].sort((a, b) => a.end - b.end).map((l) => l.c.id)

  const [t, setT] = useState(0)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!playing) {
      setT(0)
      return
    }
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setT(maxEnd)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const next = ((now - t0) / 1000) * speed
      setT(Math.min(next, maxEnd))
      if (next < maxEnd) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, maxEnd])

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.setTransform(RES, 0, 0, RES, 0, 0)
    ctx.clearRect(0, 0, plotW, height)
    const written = Math.floor(t / slice)
    for (const l of placed) {
      const color = familyColor(l.c.family)
      for (let row = 0; row < l.n; row++) {
        for (let col = 0; col < cols; col++) {
          const from = col * slice
          const to = from + slice
          let phase = -1
          if (col < written) {
            l.ph.forEach((p, pi) => {
              const a = p.agents.find((ag) => ag[0] === row + 1)
              if (a && a[1] - l.offset < to && a[2] - l.offset > from) phase = pi
            })
          }
          ctx.globalAlpha = phase < 0 ? 1 : phase === l.ph.length - 1 ? 1 : 0.42
          ctx.fillStyle = phase < 0 ? INK.empty : color
          ctx.fillRect(col * PITCH, l.top + row * PITCH, CELL, CELL)
        }
      }
      // write head: the column being written right now
      if (t < l.end && written < cols && playing) {
        ctx.globalAlpha = 0.9
        ctx.fillStyle = INK.primary
        ctx.fillRect(written * PITCH, l.top - 6, CELL, laneH(l.n) + 4)
      }
    }
    ctx.globalAlpha = 1
  })

  const ticks = niceTicks(maxEnd)
  const x = (s: number) => LABEL_W + (s / maxEnd) * cols * PITCH

  return (
    <div className="race" style={{ width, height }}>
      <canvas
        ref={canvas}
        width={plotW * RES}
        height={height * RES}
        style={{ position: 'absolute', left: LABEL_W, top: 0, width: plotW, height }}
        aria-hidden="true"
      />
      <svg width={width} height={height} role="img" className="chart" aria-label="Race replay">
        <text x={LABEL_W} y={22} className="race-clock">
          T+{t.toFixed(1)} S
        </text>
        <text x={LABEL_W + cols * PITCH} y={22} textAnchor="end" className="chart-sub">
          {speed.toFixed(speed < 10 ? 1 : 0)}× replay · one row per agent
        </text>
        {ticks.map((tk) => (
          <text key={tk} x={x(tk)} y={height - 8} textAnchor="middle" className="chart-tick">
            {tk}s
          </text>
        ))}
        {placed.map((l) => {
          const done = t >= l.end
          const place = finishOrder.indexOf(l.c.id) + 1
          const mid = l.top + laneH(l.n) / 2
          return (
            <g key={l.c.id}>
              <rect x={0} y={mid - 26} width={16} height={16} fill={familyColor(l.c.family)} />
              <text x={28} y={mid - 12} dominantBaseline="middle" className="chart-label">
                {labels?.[l.c.id] ?? l.c.machineName}
              </text>
              <text x={28} y={mid + 18} dominantBaseline="middle" className="chart-sub">
                {l.c.stackName}
              </text>
              {done && (
                <g className="finish">
                  {place === 1 && <rect x={LABEL_W + cols * PITCH + 14} y={mid - 22} width={FINISH_W - 20} height={44} fill={INK.primary} />}
                  <text
                    x={LABEL_W + cols * PITCH + 28}
                    y={mid}
                    dominantBaseline="middle"
                    className={place === 1 ? 'race-time winner' : 'race-time'}
                  >
                    {fmtSeconds(l.end)}
                    <tspan dx={10} className="race-place">
                      {place === 1 ? '1ST' : `#${place}`}
                    </tspan>
                  </text>
                </g>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function niceTicks(max: number) {
  const raw = max / 5
  const step = [1, 2, 5, 10, 20, 30, 60, 120].find((s) => s >= raw) ?? Math.ceil(raw / 60) * 60
  const out: number[] = []
  for (let v = 0; v <= max; v += step) out.push(v)
  return out
}

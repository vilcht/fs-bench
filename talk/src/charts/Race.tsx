import { useEffect, useState } from 'react'
import type { Config, Phase } from '../../shared/data'
import { INK, familyColor, fmtSeconds } from '../theme'

const LABEL_W = 330
const ROW_H = 3
const ROW_GAP = 1
const LANE_GAP = 34
const FINISH_W = 150
/** Replays are compressed so the slowest lane finishes in about this many seconds. */
const TARGET_DURATION = 12

/**
 * Replays the recorded per-agent timeline of each config: one thin bar per agent, growing in
 * (compressed) real time. Checkout is drawn at half strength, install at full; one time scale for
 * every lane so the race is fair.
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
  const [t, setT] = useState(0)

  useEffect(() => {
    if (!playing) {
      setT(0)
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

  const plotW = width - LABEL_W - FINISH_W
  const x = (s: number) => LABEL_W + (s / maxEnd) * plotW
  const laneH = (n: number) => n * (ROW_H + ROW_GAP)
  let y = 30
  const placed = lanes.map((l) => {
    const top = y
    y += laneH(l.n) + LANE_GAP
    return { ...l, top }
  })
  const height = y + 30
  const finishOrder = [...lanes].sort((a, b) => a.end - b.end).map((l) => l.c.id)
  const ticks = niceTicks(maxEnd)

  return (
    <svg width={width} height={height} role="img">
      <text x={LABEL_W} y={14} fill={INK.secondary} fontSize={20} className="tnum">
        t = {t.toFixed(1)} s
      </text>
      <text x={LABEL_W + plotW} y={14} textAnchor="end" fill={INK.muted} fontSize={18}>
        replay at {speed.toFixed(speed < 10 ? 1 : 0)}× speed · each line is one agent
      </text>
      {ticks.map((tk) => (
        <g key={tk}>
          <line x1={x(tk)} x2={x(tk)} y1={26} y2={height - 26} stroke={INK.grid} strokeWidth={1} />
          <text x={x(tk)} y={height - 4} textAnchor="middle" fill={INK.muted} fontSize={18} className="tnum">
            {tk} s
          </text>
        </g>
      ))}
      {placed.map((l) => {
        const color = familyColor(l.c.family)
        const done = t >= l.end
        const place = finishOrder.indexOf(l.c.id) + 1
        const mid = l.top + laneH(l.n) / 2
        return (
          <g key={l.c.id}>
            <text x={LABEL_W - 20} y={mid - 10} textAnchor="end" dominantBaseline="middle" fill={INK.primary} fontSize={24} fontWeight={600}>
              {labels?.[l.c.id] ?? l.c.machineName}
            </text>
            <text x={LABEL_W - 20} y={mid + 18} textAnchor="end" dominantBaseline="middle" fill={INK.muted} fontSize={18}>
              {l.c.stackName}
            </text>
            {l.ph.map((p, pi) =>
              p.agents.map(([agent, s, e]) => {
                const start = s - l.offset
                const end = Math.min(e - l.offset, t)
                if (end <= start) return null
                return (
                  <rect
                    key={`${pi}-${agent}`}
                    x={x(start)}
                    y={l.top + (agent - 1) * (ROW_H + ROW_GAP)}
                    width={Math.max(1, x(end) - x(start))}
                    height={ROW_H}
                    fill={color}
                    opacity={pi === l.ph.length - 1 ? 1 : 0.45}
                  />
                )
              }),
            )}
            {done && (
              <text x={x(l.end) + 14} y={mid} dominantBaseline="middle" fill={INK.primary} fontSize={24} fontWeight={700} className="tnum">
                {fmtSeconds(l.end)}
                <tspan fill={place === 1 ? INK.good : INK.muted} fontSize={18} fontWeight={600} dx={10}>
                  {place === 1 ? '1st' : `#${place}`}
                </tspan>
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function niceTicks(max: number) {
  const raw = max / 5
  const step = [1, 2, 5, 10, 20, 30, 60, 120].find((s) => s >= raw) ?? Math.ceil(raw / 60) * 60
  const out: number[] = []
  for (let v = 0; v <= max; v += step) out.push(v)
  return out
}

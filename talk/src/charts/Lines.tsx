import { INK } from '../theme'

export interface Series {
  id: string
  label: string
  color: string
  points: { x: number; y: number }[]
}

const PAD = { top: 24, right: 380, bottom: 56, left: 80 }

function niceMax(v: number) {
  const step = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * step >= v) return m * step
  return 10 * step
}

/** Lines over categorical x positions (agent counts), linear y from 0, direct end labels. */
export function Lines({
  series,
  xs,
  width,
  height,
  yFormat,
  xLabel,
}: {
  series: Series[]
  xs: number[]
  width: number
  height: number
  yFormat: (v: number) => string
  xLabel: string
}) {
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const yMax = niceMax(Math.max(...series.flatMap((s) => s.points.map((p) => p.y))))
  const xPos = (x: number) => PAD.left + (xs.indexOf(x) / (xs.length - 1)) * plotW
  const yPos = (y: number) => PAD.top + plotH - (y / yMax) * plotH
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * yMax)

  // End labels: keep at least 30px apart, joined to their line end by a leader.
  const ends = series
    .map((s) => {
      const last = s.points[s.points.length - 1]
      return { s, x: xPos(last.x), y: yPos(last.y), ly: yPos(last.y) }
    })
    .sort((a, b) => a.y - b.y)
  for (let i = 1; i < ends.length; i++) ends[i].ly = Math.max(ends[i].ly, ends[i - 1].ly + 30)
  const overflow = ends.length ? ends[ends.length - 1].ly - (PAD.top + plotH) : 0
  if (overflow > 0) for (const e of ends) e.ly -= overflow

  return (
    <svg width={width} height={height} role="img" className="chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={PAD.left + plotW} y1={yPos(t)} y2={yPos(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={t === 0 ? 2 : 1} />
          <text x={PAD.left - 14} y={yPos(t)} textAnchor="end" dominantBaseline="middle" className="chart-tick">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xs.map((x) => (
        <text key={x} x={xPos(x)} y={PAD.top + plotH + 34} textAnchor="middle" className="chart-tick">
          {x}
        </text>
      ))}
      <text x={PAD.left + plotW / 2} y={height - 2} textAnchor="middle" className="chart-sub">
        {xLabel}
      </text>
      {series.map((s) => (
        <g key={s.id}>
          <polyline
            points={s.points.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={4}
            strokeLinejoin="miter"
          />
          {s.points.map((p) => (
            <rect key={p.x} x={xPos(p.x) - 8} y={yPos(p.y) - 8} width={16} height={16} fill={s.color} stroke={INK.void} strokeWidth={3}>
              <title>{`${s.label}, ${p.x} agents: ${yFormat(p.y)}`}</title>
            </rect>
          ))}
        </g>
      ))}
      {ends.map((e) => (
        <g key={e.s.id}>
          <line x1={e.x + 8} y1={e.y} x2={e.x + 30} y2={e.ly} stroke={INK.axis} strokeWidth={1} />
          <rect x={e.x + 34} y={e.ly - 7} width={14} height={14} fill={e.s.color} />
          <text x={e.x + 58} y={e.ly} dominantBaseline="middle" className="chart-label small">
            {e.s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

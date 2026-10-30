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
    <svg width={width} height={height} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD.left} x2={PAD.left + plotW} y1={yPos(t)} y2={yPos(t)} stroke={t === 0 ? INK.axis : INK.grid} strokeWidth={1} />
          <text x={PAD.left - 14} y={yPos(t)} textAnchor="end" dominantBaseline="middle" fill={INK.muted} fontSize={18} className="tnum">
            {yFormat(t)}
          </text>
        </g>
      ))}
      {xs.map((x) => (
        <text key={x} x={xPos(x)} y={PAD.top + plotH + 30} textAnchor="middle" fill={INK.muted} fontSize={20} className="tnum">
          {x}
        </text>
      ))}
      <text x={PAD.left + plotW / 2} y={height - 2} textAnchor="middle" fill={INK.muted} fontSize={18}>
        {xLabel}
      </text>
      {series.map((s) => (
        <g key={s.id}>
          <polyline
            points={s.points.map((p) => `${xPos(p.x)},${yPos(p.y)}`).join(' ')}
            fill="none"
            stroke={s.color}
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {s.points.map((p) => (
            <circle key={p.x} cx={xPos(p.x)} cy={yPos(p.y)} r={5} fill={s.color} stroke={INK.surface} strokeWidth={2}>
              <title>{`${s.label}, ${p.x} agents: ${yFormat(p.y)}`}</title>
            </circle>
          ))}
        </g>
      ))}
      {ends.map((e) => (
        <g key={e.s.id}>
          <line x1={e.x + 8} y1={e.y} x2={e.x + 30} y2={e.ly} stroke={INK.axis} strokeWidth={1} />
          <circle cx={e.x + 40} cy={e.ly} r={5} fill={e.s.color} />
          <text x={e.x + 52} y={e.ly} dominantBaseline="middle" fill={INK.primary} fontSize={20}>
            {e.s.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

import { INK } from '../theme'

export interface ScatterPoint {
  id: string
  label: string
  sub?: string
  x: number
  y: number
  color: string
  /** Label placement relative to the mark. */
  anchor?: 'right' | 'left' | 'above' | 'below' | 'below-left'
}

const PAD = { top: 30, right: 40, bottom: 90, left: 110 }

/**
 * Cost of one agent alone (x, log scale) against how much running 16 at once helps (y).
 * Square marks like the rest of the deck; the y = 1 line is "no better than one after another".
 */
export function Scatter({
  points,
  width,
  height,
  xTicks,
  yTicks,
  xLabel,
  yLabel,
  xFormat,
  yFormat,
}: {
  points: ScatterPoint[]
  width: number
  height: number
  xTicks: number[]
  yTicks: number[]
  xLabel: string
  yLabel: string
  xFormat: (v: number) => string
  yFormat: (v: number) => string
}) {
  const plotW = width - PAD.left - PAD.right
  const plotH = height - PAD.top - PAD.bottom
  const [x0, x1] = [Math.min(...xTicks), Math.max(...xTicks)]
  const [y0, y1] = [Math.min(...yTicks), Math.max(...yTicks)]
  const xPos = (v: number) => PAD.left + ((Math.log(v) - Math.log(x0)) / (Math.log(x1) - Math.log(x0))) * plotW
  const yPos = (v: number) => PAD.top + plotH - ((v - y0) / (y1 - y0)) * plotH
  const M = 22
  return (
    <svg width={width} height={height} role="img" className="chart" aria-label={`${yLabel} against ${xLabel}`}>
      {yTicks.map((t) => (
        <g key={`y${t}`}>
          <line x1={PAD.left} x2={width - PAD.right} y1={yPos(t)} y2={yPos(t)} stroke={t === 1 ? INK.secondary : INK.grid} strokeWidth={t === 1 ? 3 : 2} strokeDasharray={t === 1 ? '10 8' : undefined} />
          <text x={PAD.left - 18} y={yPos(t)} textAnchor="end" dominantBaseline="middle" className="chart-tick">
            {yFormat(t)}
          </text>
        </g>
      ))}
      <text x={PAD.left + plotW * 0.42} y={yPos(1) + 30} className="chart-sub">
        1× = no faster than one after another
      </text>
      {xTicks.map((t) => (
        <g key={`x${t}`}>
          <line x1={xPos(t)} x2={xPos(t)} y1={PAD.top} y2={PAD.top + plotH} stroke={INK.grid} strokeWidth={2} />
          <text x={xPos(t)} y={PAD.top + plotH + 32} textAnchor="middle" className="chart-tick">
            {xFormat(t)}
          </text>
        </g>
      ))}
      <text x={PAD.left + plotW / 2} y={height - 18} textAnchor="middle" className="chart-sub">
        {xLabel} →
      </text>
      <text x={24} y={PAD.top + plotH / 2} textAnchor="middle" className="chart-sub" transform={`rotate(-90 24 ${PAD.top + plotH / 2})`}>
        {yLabel} →
      </text>
      {points.map((p) => {
        const cx = xPos(p.x)
        const cy = yPos(p.y)
        const a = p.anchor ?? 'right'
        const left = a === 'left' || a === 'below-left'
        const below = a === 'below' || a === 'below-left'
        const lx = a === 'right' ? cx + M + 6 : left ? cx + M / 2 : cx
        const ly = a === 'above' ? cy - M - 30 : below ? cy + M + 22 : cy - (p.sub ? 10 : 0)
        const anchor = a === 'right' ? 'start' : left ? 'end' : 'middle'
        return (
          <g key={p.id}>
            <title>{`${p.label}: ${xFormat(p.x)} alone, ${yFormat(p.y)} speedup`}</title>
            <rect x={cx - M / 2} y={cy - M / 2} width={M} height={M} fill={p.color} stroke={INK.void} strokeWidth={3} />
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="chart-label small halo">
              {p.label}
            </text>
            {p.sub && (
              <text x={lx} y={ly + 26} textAnchor={anchor} dominantBaseline="middle" className="chart-sub halo">
                {p.sub}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

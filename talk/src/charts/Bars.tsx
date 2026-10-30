import { INK } from '../theme'

export interface BarItem {
  id: string
  label: string
  sub?: string
  value: number
  color: string
  note?: string
}

const ROW = 84
const CELL = 24
const PITCH = 28
const VALUE_W = 200

/**
 * Horizontal bars built from sectors: one run of square cells per item, length rounded to the
 * nearest cell (the exact value is printed at the tip).
 */
export function Bars({
  items,
  width,
  format,
  max,
  labelWidth = 400,
}: {
  items: BarItem[]
  width: number
  format: (v: number) => string
  max?: number
  labelWidth?: number
}) {
  const top = max ?? Math.max(...items.map((i) => i.value))
  const maxCells = Math.floor((width - labelWidth - VALUE_W) / PITCH)
  const height = items.length * ROW
  return (
    <svg width={width} height={height} role="img" className="chart">
      {items.map((item, i) => {
        const y = i * ROW + (ROW - CELL) / 2
        const n = Math.max(1, Math.round((item.value / top) * maxCells))
        const tip = labelWidth + n * PITCH + 12
        return (
          <g key={item.id}>
            <title>{`${item.label}${item.sub ? ` · ${item.sub}` : ''}: ${format(item.value)}`}</title>
            <text x={labelWidth - 24} y={y + CELL / 2 - (item.sub ? 11 : 0)} textAnchor="end" dominantBaseline="middle" className="chart-label">
              {item.label}
            </text>
            {item.sub && (
              <text x={labelWidth - 24} y={y + CELL / 2 + 19} textAnchor="end" dominantBaseline="middle" className="chart-sub">
                {item.sub}
              </text>
            )}
            {Array.from({ length: n }, (_, c) => (
              <rect
                key={c}
                x={labelWidth + c * PITCH}
                y={y}
                width={CELL}
                height={CELL}
                fill={item.color}
              />
            ))}
            <text x={tip} y={y + CELL / 2} dominantBaseline="middle" className="chart-value">
              {format(item.value)}
              {item.note && (
                <tspan className="chart-note" dx={14}>
                  {item.note}
                </tspan>
              )}
            </text>
          </g>
        )
      })}
      <line x1={labelWidth - 8} x2={labelWidth - 8} y1={0} y2={height} stroke={INK.axis} strokeWidth={2} />
    </svg>
  )
}

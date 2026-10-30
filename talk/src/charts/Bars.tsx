import { INK } from '../theme'

export interface BarItem {
  id: string
  label: string
  sub?: string
  value: number
  color: string
  note?: string
}

const ROW = 72
const THICK = 24
const VALUE_W = 190

/** Horizontal bar with a 4px rounded data end, square at the baseline. */
export function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w)
  return `M${x},${y} h${w - r} a${r},${r} 0 0 1 ${r},${r} v${h - 2 * r} a${r},${r} 0 0 1 ${-r},${r} h${-(w - r)} z`
}

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
  const LABEL_W = labelWidth
  const top = max ?? Math.max(...items.map((i) => i.value))
  const plotW = width - LABEL_W - VALUE_W
  const height = items.length * ROW
  return (
    <svg width={width} height={height} role="img">
      <line x1={LABEL_W} x2={LABEL_W} y1={0} y2={height} stroke={INK.axis} strokeWidth={1} />
      {items.map((item, i) => {
        const y = i * ROW + (ROW - THICK) / 2
        const w = Math.max(2, (item.value / top) * plotW)
        return (
          <g key={item.id}>
            <title>{`${item.label}${item.sub ? ` · ${item.sub}` : ''}: ${format(item.value)}`}</title>
            <text x={LABEL_W - 20} y={y + THICK / 2 - (item.sub ? 9 : 0)} textAnchor="end" dominantBaseline="middle" fill={INK.primary} fontSize={24} fontWeight={600}>
              {item.label}
            </text>
            {item.sub && (
              <text x={LABEL_W - 20} y={y + THICK / 2 + 17} textAnchor="end" dominantBaseline="middle" fill={INK.muted} fontSize={18}>
                {item.sub}
              </text>
            )}
            <path d={barPath(LABEL_W + 1, y, w, THICK)} fill={item.color} />
            <text x={LABEL_W + w + 14} y={y + THICK / 2} dominantBaseline="middle" fill={INK.primary} fontSize={24} fontWeight={600} className="tnum">
              {format(item.value)}
              {item.note && (
                <tspan fill={INK.secondary} fontWeight={400} dx={12}>
                  {item.note}
                </tspan>
              )}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

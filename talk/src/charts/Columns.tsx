import { INK } from '../theme'

export interface Column {
  label: string
  value: number
  hidden?: boolean
}

const THICK = 24

function columnPath(x: number, base: number, h: number) {
  const r = Math.min(4, h)
  return `M${x},${base} v${-(h - r)} a${r},${r} 0 0 1 ${r},${-r} h${THICK - 2 * r} a${r},${r} 0 0 1 ${r},${r} v${h - r} z`
}

/** One series of columns; a hidden column shows a "?" placeholder at the same slot. */
export function Columns({
  columns,
  color,
  width,
  height,
  format,
  max,
}: {
  columns: Column[]
  color: string
  width: number
  height: number
  format: (v: number) => string
  max: number
}) {
  const base = height - 48
  const plotH = base - 48
  const slot = width / columns.length
  return (
    <svg width={width} height={height} role="img">
      <line x1={0} x2={width} y1={base} y2={base} stroke={INK.axis} strokeWidth={1} />
      {columns.map((c, i) => {
        const x = i * slot + slot / 2 - THICK / 2
        const h = Math.max(2, (c.value / max) * plotH)
        return (
          <g key={c.label}>
            {c.hidden ? (
              <>
                <rect x={x - 8} y={base - plotH} width={THICK + 16} height={plotH} fill="none" stroke={INK.axis} rx={4} />
                <text x={x + THICK / 2} y={base - plotH / 2} textAnchor="middle" dominantBaseline="middle" fill={INK.secondary} fontSize={48} fontWeight={700}>
                  ?
                </text>
              </>
            ) : (
              <>
                <path d={columnPath(x, base, h)} fill={color} />
                <text x={x + THICK / 2} y={base - h - 14} textAnchor="middle" fill={INK.primary} fontSize={22} fontWeight={600} className="tnum">
                  {format(c.value)}
                </text>
              </>
            )}
            <text x={x + THICK / 2} y={base + 32} textAnchor="middle" fill={INK.muted} fontSize={20}>
              {c.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

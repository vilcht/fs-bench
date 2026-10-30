import { BlockText } from '../blocks/BlockText'
import { INK } from '../theme'

export interface Column {
  label: string
  value: number
  hidden?: boolean
}

const CELL = 22
const PITCH = 26
const WIDE = 3 // cells per tower

/** One series of sector towers; a hidden tower is an empty frame with a block "?". */
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
  const base = height - 52
  const maxRows = Math.floor((base - 56) / PITCH)
  const slot = width / columns.length
  const towerW = WIDE * PITCH - (PITCH - CELL)
  return (
    <div className="columns" style={{ width, height }}>
      <svg width={width} height={height} role="img" className="chart">
        <line x1={0} x2={width} y1={base + 4} y2={base + 4} stroke={INK.axis} strokeWidth={2} />
        {columns.map((col, i) => {
          const x0 = i * slot + slot / 2 - towerW / 2
          const rows = Math.max(1, Math.round((col.value / max) * maxRows))
          return (
            <g key={col.label}>
              {col.hidden ? (
                <rect x={x0 - 6} y={base - maxRows * PITCH + (PITCH - CELL) - 6} width={towerW + 12} height={maxRows * PITCH + 6} className="tower-frame" />
              ) : (
                <>
                  {Array.from({ length: rows * WIDE }, (_, k) => {
                    const r = Math.floor(k / WIDE)
                    const c = k % WIDE
                    return (
                      <rect
                        key={k}
                        x={x0 + c * PITCH}
                        y={base - (r + 1) * PITCH + (PITCH - CELL)}
                        width={CELL}
                        height={CELL}
                        fill={color}
                      />
                    )
                  })}
                  <text x={x0 + towerW / 2} y={base - rows * PITCH - 12} textAnchor="middle" className="chart-value">
                    {format(col.value)}
                  </text>
                </>
              )}
              <text x={x0 + towerW / 2} y={base + 40} textAnchor="middle" className="chart-sub">
                {col.label}
              </text>
            </g>
          )
        })}
      </svg>
      {columns.map((col, i) =>
        col.hidden ? (
          <div key={col.label} className="tower-q" style={{ left: i * slot + slot / 2, top: base - (maxRows * PITCH) / 2 }}>
            <BlockText text="?" cell={14} />
          </div>
        ) : null,
      )}
    </div>
  )
}

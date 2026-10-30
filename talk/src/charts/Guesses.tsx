import { INK } from '../theme'

const CELL = 14
const PITCH = 17

/** Every audience guess as a sector on a log axis, stacked where they collide, with the answer marked. */
export function Guesses({
  guesses,
  answer,
  min,
  max,
  width,
  format,
}: {
  guesses: number[]
  answer: number
  min: number
  max: number
  width: number
  format: (v: number) => string
}) {
  const pad = 40
  const height = 170
  const base = height - 48
  const lmin = Math.log(min)
  const lmax = Math.log(max)
  const x = (v: number) => pad + ((Math.log(Math.min(max, Math.max(min, v))) - lmin) / (lmax - lmin)) * (width - 2 * pad)
  const stacks = new Map<number, number>()
  const cells = guesses.map((g) => {
    const bucket = Math.round(x(g) / PITCH)
    const level = stacks.get(bucket) ?? 0
    stacks.set(bucket, level + 1)
    return { x: bucket * PITCH - CELL / 2, y: base - (level + 1) * PITCH, g }
  })
  const ticks: number[] = []
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (v >= min && v <= max) ticks.push(v)
    }
  }
  return (
    <svg width={width} height={height} role="img" className="chart">
      <line x1={pad} x2={width - pad} y1={base + 2} y2={base + 2} stroke={INK.axis} strokeWidth={2} />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={base + 32} textAnchor="middle" className="chart-tick">
          {format(t)}
        </text>
      ))}
      {cells.map((c, i) => (
        <rect key={i} x={c.x} y={Math.max(24, c.y)} width={CELL} height={CELL} fill={INK.secondary}>
          <title>{format(c.g)}</title>
        </rect>
      ))}
      <rect x={x(answer) - 2} y={22} width={4} height={base - 20} fill={INK.primary} />
      <text x={x(answer)} y={14} textAnchor="middle" className="chart-value">
        answer {format(answer)}
      </text>
    </svg>
  )
}

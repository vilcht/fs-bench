import { INK } from '../theme'

/** Every audience guess as a dot on a log axis, stacked where they collide, with the answer marked. */
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
  const height = 190
  const base = height - 50
  const lmin = Math.log(min)
  const lmax = Math.log(max)
  const x = (v: number) => pad + ((Math.log(Math.min(max, Math.max(min, v))) - lmin) / (lmax - lmin)) * (width - 2 * pad)
  const stacks = new Map<number, number>()
  const dots = guesses.map((g) => {
    const bucket = Math.round(x(g) / 14)
    const level = stacks.get(bucket) ?? 0
    stacks.set(bucket, level + 1)
    return { cx: bucket * 14, cy: base - 10 - level * 14, g }
  })
  const ticks: number[] = []
  for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
    for (const m of [1, 2, 5]) {
      const v = m * 10 ** e
      if (v >= min && v <= max) ticks.push(v)
    }
  }
  return (
    <svg width={width} height={height} role="img">
      <line x1={pad} x2={width - pad} y1={base} y2={base} stroke={INK.axis} strokeWidth={1} />
      {ticks.map((t) => (
        <text key={t} x={x(t)} y={base + 28} textAnchor="middle" fill={INK.muted} fontSize={18} className="tnum">
          {format(t)}
        </text>
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={Math.max(8, d.cy)} r={5} fill={INK.secondary} stroke={INK.surface} strokeWidth={2}>
          <title>{format(d.g)}</title>
        </circle>
      ))}
      <line x1={x(answer)} x2={x(answer)} y1={20} y2={base} stroke={INK.primary} strokeWidth={2} />
      <text x={x(answer)} y={12} textAnchor="middle" fill={INK.primary} fontSize={20} fontWeight={700}>
        answer {format(answer)}
      </text>
    </svg>
  )
}

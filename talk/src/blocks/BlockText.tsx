import { useMemo } from 'react'
import { layoutText } from './font'

/**
 * Text drawn as disk sectors. With `write`, the cells appear column by column, as if a write
 * head swept across them (skipped under reduced motion, see styles.css).
 */
export function BlockText({
  text,
  cell,
  gap = Math.max(1, Math.round(cell * 0.18)),
  color = 'var(--ink)',
  write = false,
  className,
}: {
  text: string
  cell: number
  gap?: number
  color?: string
  write?: boolean
  className?: string
}) {
  const layout = useMemo(() => layoutText(text), [text])
  const pitch = cell
  const size = cell - gap
  return (
    <svg
      className={className}
      width={layout.cols * pitch - gap}
      height={layout.rows * pitch - gap}
      role="img"
      aria-label={text.replace(/\n/g, ' ')}
    >
      {layout.cells.map(([c, r]) => (
        <rect
          key={`${c}-${r}`}
          x={c * pitch}
          y={r * pitch}
          width={size}
          height={size}
          fill={color}
          className={write ? 'cell-write' : undefined}
          style={write ? { animationDelay: `${c * 18 + r * 6}ms` } : undefined}
        />
      ))}
    </svg>
  )
}

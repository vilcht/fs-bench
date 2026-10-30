import { type ReactNode, useEffect, useRef, useState } from 'react'

export const STAGE_W = 1600
export const STAGE_H = 900

/** Renders children on a fixed 1600×900 canvas, scaled to fit its container. */
export function Stage({ children }: { children: ReactNode }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setScale(Math.min(width / STAGE_W, height / STAGE_H))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    <div className="stage-outer" ref={outer}>
      <div className="stage" style={{ width: STAGE_W, height: STAGE_H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}

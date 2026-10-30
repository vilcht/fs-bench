import QRCode from 'qrcode'
import { useEffect, useState } from 'react'

export function JoinCard({ url, players }: { url: string; players: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' }).then(setSvg)
  }, [url])
  return (
    <div className="join-card">
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="join-url">{url.replace(/^https?:\/\//, '')}</div>
      <div className="join-count tnum">
        {players} {players === 1 ? 'player' : 'players'} joined
      </div>
    </div>
  )
}

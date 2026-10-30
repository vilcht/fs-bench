import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { BlockText } from './blocks/BlockText'

export function JoinCard({ url, players }: { url: string; players: number }) {
  const [svg, setSvg] = useState('')
  useEffect(() => {
    QRCode.toString(url, { type: 'svg', margin: 2, errorCorrectionLevel: 'M', color: { dark: '#121318', light: '#f3f2ee' } }).then(setSvg)
  }, [url])
  return (
    <div className="join-card">
      <div className="join-head">Join and vote</div>
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="join-url">{url.replace(/^https?:\/\//, '')}</div>
      <div className="join-count">
        <BlockText text={String(players)} cell={8} />
        <span>{players === 1 ? 'player' : 'players'} in</span>
      </div>
    </div>
  )
}

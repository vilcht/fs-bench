import { useCallback, useEffect, useRef, useState } from 'react'
import type { ClientMessage, Role, RoomState, ServerMessage } from '../shared/protocol'

export function useRoom(role: Role, params: { id?: string; key?: string }) {
  const [state, setState] = useState<RoomState | null>(null)
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ws = useRef<WebSocket | null>(null)

  useEffect(() => {
    let stopped = false
    let attempt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const connect = () => {
      const url = new URL('/api/ws', location.href)
      url.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      url.searchParams.set('role', role)
      if (params.id) url.searchParams.set('id', params.id)
      if (params.key) url.searchParams.set('key', params.key)
      const socket = new WebSocket(url)
      ws.current = socket
      socket.onopen = () => {
        attempt = 0
        setConnected(true)
      }
      socket.onmessage = (e) => {
        const msg = JSON.parse(e.data) as ServerMessage
        if (msg.t === 'state') {
          setState(msg.state)
          setError(null)
        } else {
          setError(msg.message)
        }
      }
      socket.onclose = () => {
        setConnected(false)
        if (!stopped) timer = setTimeout(connect, Math.min(5000, 400 * 2 ** attempt++))
      }
    }
    connect()
    return () => {
      stopped = true
      clearTimeout(timer)
      ws.current?.close()
    }
  }, [role, params.id, params.key])

  const send = useCallback((msg: ClientMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) ws.current.send(JSON.stringify(msg))
  }, [])

  return { state, connected, error, send }
}

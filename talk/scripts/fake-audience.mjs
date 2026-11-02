// Fake audience for rehearsing: bots join, move their cursors around the slide and vote on every round.
//
//   node scripts/fake-audience.mjs [url] [bots] [minutes]
//   node scripts/fake-audience.mjs https://fs-bench-talk.terenoewt.workers.dev 8 20
//
// Guesses are random between 0.5× and 3× (valid on every round), so the bots are bad at the Windows and delete
// rounds, like most real people. Press Shift+R in the presenter view afterwards to clear them.
const [url = 'http://localhost:5173', count = '8', minutes = '20'] = process.argv.slice(2)
const NAMES = ['Ania', 'Bartek', 'Celina', 'Damian', 'Ela', 'Filip', 'Gosia', 'Hubert', 'Iga', 'Janek', 'Kasia', 'Leon']

for (let i = 0; i < Number(count); i++) {
  const u = new URL('/api/ws', url)
  u.protocol = u.protocol.replace('http', 'ws')
  u.searchParams.set('role', 'audience')
  u.searchParams.set('id', `fake-${i}-${Date.now()}`)
  const ws = new WebSocket(u)
  const voted = new Set()
  ws.onopen = () => {
    ws.send(JSON.stringify({ t: 'join', name: `${NAMES[i % NAMES.length]} (bot)` }))
    let x = Math.random()
    let y = Math.random()
    setInterval(() => {
      x = Math.min(0.97, Math.max(0.03, x + (Math.random() - 0.5) * 0.05))
      y = Math.min(0.95, Math.max(0.05, y + (Math.random() - 0.5) * 0.05))
      ws.send(JSON.stringify({ t: 'cursor', x, y }))
    }, 500)
  }
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data)
    if (m.t !== 'state') return
    for (const [id, view] of Object.entries(m.state.polls)) {
      if (view.status !== 'open' || voted.has(id)) continue
      voted.add(id)
      const guess = Math.exp(Math.log(0.5) + Math.random() * (Math.log(3) - Math.log(0.5)))
      setTimeout(() => ws.send(JSON.stringify({ t: 'vote', pollId: id, value: guess })), 1500 + Math.random() * 6000)
    }
  }
  ws.onerror = () => console.error(`bot ${i}: connection failed`)
}
console.log(`${count} bots joined ${url} for ${minutes} min. Ctrl+C to stop.`)
setTimeout(() => process.exit(0), Number(minutes) * 60_000)

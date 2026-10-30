# Talk: 16 agents, one SSD

One-off site for the knowledge-sharing session: slides and live voting in one place.
The presenter drives the slides; everyone who opens the site follows along, their mouse cursors show up
live on everyone's slide, and they vote when a round opens.

Every vote is a higher/lower round (`shared/polls.ts`): one machine's time is known, the next machine is
shown, and everyone drags a log slider (0.5×–3×, widened when the answer is near an end) for how many times
as long it takes. Exact guess = 1000 points, 2.5× off = 0. The reveal shows the real multiple, all guesses,
and the three closest players. Scores go to a leaderboard.

- `/`: audience (pick a name, follow the slides, vote)
- `/present?key=…`: presenter. The key is removed from the address bar after load, so it never shows on screen share.
- `/notes?key=…`: speaker notes, timer, vote counts and poll answers for a second screen

Presenter keys: `→` / `Space` / `PageDown` next (on a poll slide: first press reveals),
`←` / `PageUp` back, `F` fullscreen, `H` hide the status line, `Shift+R` reset all votes and players.

## Data

```sh
# unpack each machine's results: tar -xzf fsbench-results-*.tar.gz -C ../results
pnpm data   # ../results/*/ -> shared/data/results.json
```

`machines.json` maps run labels to machines (names and details shown on slides) and lists the configs the
deck expects. Any expected config without a real run gets mock numbers, and every slide drawing on them shows a
red MOCK DATA badge. `pnpm data` prints which configs are real.

## Run locally

```sh
pnpm install
echo PRESENTER_KEY=dev > .dev.vars
pnpm dev    # http://localhost:5173, presenter at /present?key=dev
```

## Deploy (Cloudflare Workers, free plan)

```sh
pnpm exec wrangler login
pnpm exec wrangler secret put PRESENTER_KEY
pnpm deploy
```

Live state (slide, votes, players) lives in one Durable Object. Press `Shift+R` before the talk to clear test votes.

# Bigg Boss House — Progress Log

Session checkpoint. Continue here next session.

## Sever / ports
- Dev server: `PORT=3900 node server.js > /tmp/opencode/bb-server.log 2>&1 &` (capture PID, poll the log — node can take a few seconds under memory pressure; **do NOT use `pkill -f "node server.js"`** — it kills the opencode shell itself; use `kill <PID>` or `pkill -f "[n]ode server.js"`).
- House passcode: `jayichal` (lowercase). Client dev socket always targets `:3000`; production same-origin.
- Act cycle: `ACT_SEQ = ['order','chore','cook','game']`; game acts at act%4==0, mode rotates `MODES[(act/4-1)%3]`. Fresh server: welcome ~0.9s, act1(order) ~7.7s.

## What's built (DONE, mostly verified)
- **BB conductor** in `server.js`: 4 rotating acts — instant proximity group-orders, cleaning chores, kitchen cooking, Malayalam cinema games (trivia/picture/word), coins economy (+50 group, 100 correct + up to 60 fast bonus, word yell +40, chore +10, champ +30, attendance +5, penalty −10), top-8 leaderboard, reveal/praise/scold text from `shared/bb.js`.
- **Whispers**: `chat_priv` (target must be within CHAT_RADIUS=320); UI lock button in `Game.jsx`, 🔒 log rows, `whisper-btn` styles.
- **Client**: `Quiz.jsx` BiggBossDesk, `engine.js` E/R interaction + bb-event sounds, `render.js` arena carpet + grime/pot drawings, `sound.js` new cues.

## Verification status
- `node --check` OK on server.js / shared/bb.js / shared/map.js.
- Unit `/tmp/opencode/bbunit.mjs`: PASS=35 FAIL=0 (note: DISH ingredient key is `leaf` — Kariveppila).
- Raw sockets `/tmp/opencode/pw/coins2.mjs`: **COINS-OK** — 2 logins, group order +50 each, leaderboard 2 rows.
- Conductor `/tmp/opencode/pw/conductor.mjs` (embeds server in-process for low memory): PASS order/coins/leaderboard, chore-outside-reject, game bank lookup. **Was failing on cook + chore-spots due to two bugs found this session — fix below explains.**

## Bugs found & fixed (DONE, this session)
1. **Cell-size mismatch (server) — FIXED** — `randomWalkableSpots` hardcoded `cell = 40` but `buildGrid()` uses `CELL = 20` (grid 120×85) → 0 spots in every room. Also it indexed `grid[...]` on the OBJECT returned by `buildGrid()` instead of `.grid` (the Uint8Array) → always undefined. Now `const { grid: walkGrid, cols, rows } = buildGrid()` + `CELL`.
2. **Kitchen collisions block WASD / cooking — FIXED** — `client _canPlace` (RADIUS=13, 4-corner check) reported stations & stove NOT walkable (island/counter/fridge walls). Changed: kitchen island moved to `{x:460,y:1320,w:200,h:52}` (opens counter-front aisle), `COOK_STATIONS` relocated to 15 verified-standable tiles (two rows west/east aisle y1278/y1300 + south corners), `COOK_SPOT` = `{x:560,y:1220,r:70}` (reachable standing y~1275, dist 55). Verified: all rooms ≥126 walkable cells, every station/stove/arena/spawn corner-standable via `walkable.mjs`.
3. **cook_interact ordering — FIXED** — stove-ring check ran BEFORE grab → standing within 70 of stove (e.g. station `[530,1278]`, 65px away) triggered a cook attempt (wrong-ingredients dump) instead of grabbing. Now grab-nearest(≤52) is checked FIRST, then stove ring, then "Nothing to grab nearby."

## Verification (ALL GREEN)
- `node --check` OK.
- `walkable.mjs`: all cook stations + stove + arena + spawn corner-standable; rooms: living 725, bedroom 571, powder 320, bath 326, courtyard 614, kitchen 135, dining 234, confession 324 cells.
- `conductor.mjs` (now runs against a REMOTE fresh server — embedded server option FREEZES the process ~35s under this machine's RAM): **CONDUCTOR: ALL CHECKS PASSED** — order (+50/2 rows), chore (reject→clean +10→reject), cook (grab all req → "🍲 Meen Mulakittathu is ready! +158" → wrong rejected), game (bank answer, arena reject, correct +158, 2nd-player reject).
- Client rebuilt: `dist/assets/index-CUevyCuX.js`.
- **Secret-leak check**: built bundle contains NO quiz/word/dish answers (`drishyam/manichitrathazhu/puttukadala/angamaly` = 0 hits); only COOK_ITEMS name/emoji map survives (not secret) — Quiz.jsx import is safe.

## Known infra quirk
- Embedded-server tests (conductor importing server.js into the same node process) freeze the process ~30–36s in on this box (memory pressure) — the standalone server process runs fine for hours. Prefer: `setsid bash -c 'cd <repo> && PORT=3900 exec node server.js >> /tmp/opencode/bb-server.log 2>&1' </dev/null >/dev/null 2>&1 &` (fully redirect EVERYTHING or the bash tool wedges), then run tests against 127.0.0.1:3900.
- The earlier "askA dynamic listener" flakiness was avoided by a persistent event queue (`nextBB()` in conductor.mjs).

## Test scripts (in /tmp/opencode — may not persist across reboot; re-write from session if needed)
- `pb/pw/bbtest.mjs` — headless browser E2E (login, desk, coins, whisper, public chat). Previously passed except flaky board-rows (<2). Browser needs big RAM; kill stale servers/processes first.
- `pw/conductor.mjs` — in-process server + 2 raw sockets; walks a fake player to spots; asserts chore clean +10, cook grab/success/wrong-reject, arena-gated quiz answers, word yell path. This is the fastest full-cycle verify (no browser).
- `pw/coins2.mjs`, `pw/choregrid.mjs`, `pw/walkable.mjs`, `pw/diag.mjs`.

## Still OPEN / next session
- Re-run `conductor.mjs` after the two fixes (expect chore + cook + game all green, including wrong-ingredient reject and "outside arena" reject). — **DONE 25 Sep: CONDUCTOR: ALL CHECKS PASSED (see Verification).**
- Secret-leak check: `Quiz.jsx` imports `COOK_ITEMS` from `shared/bb.js` -> verify built bundle `client/dist/assets/index-*.js` does NOT contain answer strings (e.g. `drishyam`, `manichitrathazhu`); safer to drop that import (cook event carries `items[].detail` with emoji+name) so answers stay server-only. — **DONE: 0 hits for `drishyam/manichitrathazhu/puttukadala/angamaly` in built bundle (tree-shaken); only COOK_ITEMS name/emoji map survives (not secret), safe to keep.**
- Browser E2E re-run optional (memory-tight machine; headless chrome dies under ~25MB free — run at most one browser, kill vite/node first).
- User feature request: "make WASD work everywhere a user can access" — root cause is kitchen collision bug #2 above; after fix, WASD works at all cook stations, stove, arena, and room floors. Consider a full-room walkability carve in `buildGrid` later if any room interior still feels blocked. — **DONE + hardened: see "Mobile / WASD" section below.**

## Mobile responsive + touch controls (DONE 25 Sep)
User asked: responsive for mobile, on-screen controls, and to TEST WASD in the kitchen.
- **`MobileControls.jsx`** (new): pointer-based virtual joystick (bottom-left) + ✋/🫳 action buttons (bottom-right) wired to `engine.setJoystick/act/drop`. Joystick analog vector merges with keyboard in `engine._dir()` (joystick wins above threshold 0.15). Buttons use `pointerdown` + `touch-action` for no-double-tap-zoom; shown only for coarse pointers / ≤820px (`@media`).
- **`engine.js`**: added `joy` axis, `setJoystick()`, `act()`, `drop()` public APIs.
- **`Game.jsx`**: `isTouch` detection; housemates list + BB Desk collapse behind toggle buttons on touch; `MobileControls` rendered; hint-banner hidden on mobile.
- **`Quiz.jsx`**: optional `onClose` prop → ✕ close button (touch-only) in the desk header.
- **`index.css`**: responsive block — compact top HUD, chat-bar moves to top (below HUD) on mobile, chat log floats above controls, players list becomes a togglable panel, BB Desk becomes a togglable bottom sheet (z-index 9, scrollable), toast/conn-warning repositioned, mobile login sizing ≤480px.
- Client rebuilt: `dist/assets/index-Br3OyVcj.js`.

## Kitchen WASD test — found + fixed a REAL connectivity bug (DONE 25 Sep)
`/tmp/opencode/pw/kitchen-wasd.mjs` simulates the client engine's exact collision (RADIUS=13 → r=12, 4 corners + center, CELL=20) and BFS-walks ONLY 4-directional (W/A/S/D) steps from the kitchen doorway to every gameplay point. Result on the old map:
- All 15 stations + stove stand were **UNREACHABLE** — the cooking zone south of the north counter (y1250–1380) was **SEALED OFF**: north counter ends with only a ~20px natural gap to the dining wall (impassable for a radius-13 player), the west pocket (stations 12/13) was enclosed by the west counter + full-width fridge + island. Old `walkable.mjs` only verified points were *standable*, never *connected* — hence the false "all green".
- **Fix in `shared/map.js`**: added doorway carve `{x:700,y:1160,w:100,h:96}` (counter east-end pass, opens the stove/stations aisle) and shrank fridge `w:80→40` (opens a ~60px channel between fridge and island into the west pocket).
- Re-run: `KITCHEN WASD: ALL TARGETS REACHABLE` — 16/16 (stations 1–15 + stove stand), stove tile correctly blocked; step counts 47–174 (188–696px) from the door.
- Server has no hardcoded fridge/island/counter geometry (only `COOK_STATIONS`/`COOK_SPOT`, unchanged) so this is purely a shared/map.js change; `render.js` draws furniture generically — narrow fridge + opening render fine.

## Memory/tooling notes
- ~2.7GB total RAM, often 25–50MB free; headless chrome can be OOM-killed. Prefer raw-socket tests.
- `setsid` wedges the bash output pipe unless its stdout is also redirected to a file.

## Stove flames (DONE 25 Sep)
User asked: stove flamed when the kitchen act appears, off when over.
- `render.js`: `STOVE_BURNERS` anchors derived from the north counter furniture; `drawStoveFlames()` = 3 flickering additive-gradient flames (time-based) drawn right after the static canvas, only when `S.stoveLit`.
- `engine.js`: `bbCook` flag (public) → `stoveLit` in draw opts.
- `Game.jsx` `onBB`: `t==='cook'` → flame on; `t==='reveal'` → off; `t==='syn'` → `phase==='cook_open'`. Cook act = burner stage; reveal kills the flame.

## Voice chat (DONE 25 Sep)
User asked to add real voice chat; chosen: **hold-to-talk + proximity only** (CHAT_RADIUS=320).
- `client/src/game/voice.js` (new): `VoiceManager` — WebRTC mesh (peer cap 16 nearest, `stun.l.google.com` STUN, no TURN), lazy `getUserMedia` on first hold (AudioContext resumed inside the gesture), local track enabled only while holding, per-peer distance GainNode (`1-(d/RANGE)^2`, smooth `setTargetAtTime`), offer/answer/ICE over Socket.IO, speaking-set tracking. `sync(players, mePos)` called from Game's `onPlayers`.
- Server relays (server.js): `v_sig` (gated on target socket existing — NOT logged-in status, or offers race), `v_on`, `v_off` → broadcast `{id}`.
- `engine.js`: `speaking` Set (+ `v_on`/`v_off` handlers), `voice` ref, `setHolding()`, and `v`/`V` hold-to-talk in `_bindInput`.
- `Game.jsx`: creates `VoiceManager`, `onHold` adds/removes self in engine.speaking (own mic indicator), hint text updated.
- `MobileControls.jsx`: 🎙 hold-to-talk button (pointerdown/up/cancel/leave + contextmenu guard) → `engine.setHolding`.
- `render.js` `drawPlayer`: pulsing red "live" dot above anyone currently holding to talk.
- `index.css`: `.act-btn.mic` red styling + pressed glow.
- Verified: build `dist/assets/index-DcgntIHO.js` (client) + `index-BvPqN7RW.css`; server :3900 restarted; `/tmp/opencode/pw/voice-relay.mjs` → **VOICE RELAY OK** (v_sig offer relayed, v_on, v_off); `conductor.mjs` → **CONDUCTOR: ALL CHECKS PASSED** (order/group, chore, cook, game all green). Note: `voice-relay.mjs` expects the server to relay `v_sig` even to a not-yet-logged-in socket — that guard was relaxed deliberately.
- Caveat: no TURN server, so some symmetric-NAT users won't reach each other; works on most home/office NATs and same-network.

## GitHub / Render (DONE 25 Sep)
- Repo created & pushed: `https://github.com/yshu4743/big-boss-house` (branch `master`, commit `055225c`). `.gitignore` excludes `node_modules/`, `client/dist/`, `*.log`.
- Render = **ONE Web Service** (server.js serves `client/dist` + API + Socket.IO). Build cmd: `npm ci && npm --prefix client ci && npm run build`; start: `node server.js`; PORT auto-set by Render; client uses `['websocket','polling']` so it works through Render's proxy. No multicast/state persistence (in-memory; resets per restart). Firebase free can't host the backend (serverless, no persistent WebSockets/interval loop).
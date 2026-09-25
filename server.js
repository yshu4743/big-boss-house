import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { PORT, TICK_RATE, MOVE_THROTTLE, CHAT_RADIUS, CHAT_COOLDOWN,
         MAX_CHAT_LEN, MAX_NAME_LEN, HOUSE_PASSCODE, MAX_PLAYERS } from './shared/config.js';
import { WORLD, SPAWN, ROOMS, buildGrid, CELL, pointInRoom, pointInArena } from './shared/map.js';
import {
  ACT, MODES, MODE_LABEL, TRIVIA, PICTURE, WORD,
  GROUP_ORDERS, WELCOMES, INTROS, ORDER_INTROS, PRAISE, SCOLD,
  GAME_CORRECT, REVEAL_FAIL_USERS,
  COOK_ITEMS, DISHES, COOK_STATIONS, COOK_SPOT,
  COOK_INTROS, COOK_PRAISE, COOK_SCOLD, COOK_GUIDE,
  CHORES, CHORE_INTROS, CHORE_GUIDE, CHORE_PRAISE, CHORE_SCOLD, CHORE_CHAMP,
  POINTS, pick, shuffle, normalize, checkWord, scrambleWord,
} from './shared/bb.js';

const port = Number(process.env.PORT || PORT);

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e5, cors: { origin: '*' } });

const DIST = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(path.join(DIST, 'index.html'))) {
  app.use(express.static(DIST));
  app.get('*', (req, res) => res.sendFile(path.join(DIST, 'index.html')));
}

// --------------------------------------------------------------------------
// Player registry (authoritative-ish). Clients own their position/movement;
// the server rate-limits, clamps to world bounds and re-broadcasts together.
// --------------------------------------------------------------------------
const players = new Map(); // id -> player
const { grid: walkGrid, cols, rows } = buildGrid();  // walkability grid used to scatter task props

function randomSpawn() {
  const dx = (Math.random() - 0.5) * 300;
  const dy = (Math.random() - 0.5) * 200;
  return { x: SPAWN.x + dx, y: SPAWN.y + dy };
}

function publicPlayer(p) {
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    x: p.x,
    y: p.y,
    face: p.face,
    moving: p.moving,
    room: p.room,
    anim: p.anim,
    onlineAt: p.onlineAt,
  };
}

function broadcastPlayers() {
  const list = [...players.values()].map(publicPlayer);
  io.emit('players', list);
}

function getRoom(x, y) {
  const r = pointInRoom(x, y);
  return r ? r.name : 'House Grounds';
}

function playerRoomId(x, y) {
  const r = pointInRoom(x, y);
  return r ? r.id : null;
}

// Tick: push fresh world state to everyone
setInterval(() => {
  if (players.size === 0) return;
  broadcastPlayers();
}, 1000 / TICK_RATE);

// --------------------------------------------------------------------------
// BIGG BOSS CONDUCTOR — mixes games, orders, cooking and house-cleaning
// events into a single live show. Coins are the universal currency; players
// win them from game answers, group orders, cooking, chores and just being
// present at the right place when an event opens.
// --------------------------------------------------------------------------
const bb = {
  phase: 'idle',      // idle|announce|order_open|chore_open|cook_open|game_open
  act: 0,
  mode: null, item: null,
  order: null,
  dish: null,
  chore: null,
  timeMs: 0, deadline: 0,
  answered: new Set(),
  coins: new Map(),                 // id -> { name, color, coins }
  itemAt: new Map(),                // cook item id -> { item, x, y, takenBy, by }
  choreClean: new Map(),            // player id -> spots cleaned this chore
  choreTotal: 0,
  announceAt: 0,
  timer: null,
  groupTick: null,
  cookItems: [],                    // last emitted snapshot (for login sync)
  choreSpots: [],                   // last emitted snapshot
  questionPayload: null,
  pools: { trivia: [], picture: [], word: [], order: [], dish: [], chore: [] },
};

function bbEmit(ev) {
  io.emit('bb', ev);
}

function bbSchedule(ms, fn) {
  clearTimeout(bb.timer);
  bb.timer = setTimeout(fn, ms);
}

function refill(kind) {
  const banks = { trivia: TRIVIA, picture: PICTURE, word: WORD, order: GROUP_ORDERS, dish: DISHES, chore: CHORES };
  bb.pools[kind] = shuffle(banks[kind]);
}

function pop(kind) {
  if (!bb.pools[kind].length) refill(kind);
  return bb.pools[kind].pop();
}

function grant(id, amt, silent) {
  const p = players.get(id);
  if (!p || amt === 0) return;
  let s = bb.coins.get(id) || { name: p.name, color: p.color, coins: 0 };
  s.coins += amt;
  s.name = p.name;
  s.color = p.color;
  bb.coins.set(id, s);
  if (!silent) {
    bbEmit({ t: 'score', id, name: s.name, coins: s.coins, delta: amt, scores: leaderboard() });
  }
}

function leaderboard() {
  return [...bb.coins.values()]
    .sort((a, b) => b.coins - a.coins)
    .slice(0, 8)
    .map((s, i) => ({ rank: i + 1, ...s }));
}

function bonusFast() {
  if (bb.timeMs <= 0) return 0;
  const left = bb.deadline - Date.now();
  return Math.min(POINTS.fastMax, Math.max(0, Math.round((left / bb.timeMs) * POINTS.fastMax)));
}

function penalizeAll() {
  for (const id of players.keys()) {
    const s = bb.coins.get(id);
    if (s) {
      s.coins = Math.max(0, s.coins - POINTS.penalty);
      bb.coins.set(id, s);
    }
  }
  bbEmit({ t: 'score', delta: -POINTS.penalty, scores: leaderboard() });
}

function attendBonus(inSpot, label) {
  for (const id of players.keys()) {
    const p = players.get(id);
    if (inSpot(p.x, p.y)) {
      grant(id, POINTS.attend);
      bbEmit({ t: 'flash', text: `${label} \u2014 ${p.name} showed up. +${POINTS.attend} coins`, act: bb.act });
    }
  }
}

function syncPayload() {
  const base = { t: 'syn', phase: bb.phase, act: bb.act, scores: leaderboard() };
  if (bb.phase === 'game_open' && bb.questionPayload) base.question = { ...bb.questionPayload };
  if (bb.phase === 'order_open') {
    base.order = { ...bb.order, timeMs: bb.timeMs, deadlineAt: bb.deadline };
  }
  if (bb.phase === 'chore_open') {
    base.chore = {
      room: { id: bb.chore.room, name: (ROOMS.find(r => r.id === bb.chore.room) || {}).name },
      spotCount: bb.choreSpots.length, spots: bb.choreSpots,
      timeMs: bb.timeMs, deadlineAt: bb.deadline, guide: CHORE_GUIDE,
    };
  }
  if (bb.phase === 'cook_open') {
    base.cook = {
      dish: { id: bb.dish.id, name: bb.dish.name, emoji: bb.dish.emoji },
      items: bb.cookItems, spot: COOK_SPOT,
      timeMs: bb.timeMs, deadlineAt: bb.deadline, guide: COOK_GUIDE,
    };
  }
  return base;
}

// -------------------------------- ORDERS -----------------------------------
function buildGroups(maxDist) {
  const ids = [...players.keys()];
  const parent = new Map(ids.map(i => [i, i]));
  const find = (a) => {
    while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a))); a = parent.get(a); }
    return a;
  };
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = players.get(ids[i]), b = players.get(ids[j]);
      if (Math.hypot(a.x - b.x, a.y - b.y) <= maxDist) {
        const ra = find(ids[i]), rb = find(ids[j]);
        if (ra !== rb) parent.set(ra, rb);
      }
    }
  }
  const map = {};
  for (const id of ids) {
    const r = find(id);
    (map[r] = map[r] || []).push(id);
  }
  return Object.values(map);
}

function groupSuccess(comps, order) {
  const total = players.size;
  if (total === 0) return false;
  if (order.all) return comps.length === 1;
  const s = order.size;
  let remainder = 0;
  for (const c of comps) if (c.length < s) remainder += c.length;
  return remainder <= s - 1;
}

function startOrder() {
  const order = pop('order');
  bb.order = order;
  const ms = ACT.ORDER_MS[order.kind] || 30000;
  bb.phase = 'order_open';
  bb.timeMs = ms;
  bb.deadline = Date.now() + ms;
  bb.announceAt = Date.now();
  bbEmit({ t: 'announce', text: pick(ORDER_INTROS), act: bb.act });
  bbEmit({ t: 'order', kind: order.kind, size: order.size, text: order.text, timeMs: ms, deadlineAt: bb.deadline, act: bb.act });
  bb.groupTick = setInterval(groupTick, 1300);
  bbSchedule(ms, () => closeOrderTimeout());
}

function groupTick() {
  if (bb.phase !== 'order_open') return;
  const comps = buildGroups(134);
  const formed = comps.filter(c => c.length > 1).map(c => c.map(id => players.get(id)?.name || '?'));
  bbEmit({ t: 'group', formed, solo: comps.filter(c => c.length === 1).length, act: bb.act });
  if (groupSuccess(comps, bb.order)) {
    clearInterval(bb.groupTick);
    clearTimeout(bb.timer);
    celebrateOrder(comps, bb.order);
    bb.phase = 'announce';
    bbSchedule(5500, () => openAct(bb.act + 1));
  }
}

function celebrateOrder(comps, order) {
  const s = order.size;
  const full = comps.filter(c => (order.all ? c.length > 0 : c.length >= s));
  for (const c of full) {
    const names = c.map(id => players.get(id)?.name || '?').join(', ');
    for (const id of c) grant(id, POINTS.group);
    const label = order.all ? 'ONE BIG FAMILY' : `group of ${c.length}`;
    bbEmit({ t: 'flash', text: `\u{1F450} ${label} formed: ${names} \u2014 +${POINTS.group} coins each!`, act: bb.act });
  }
  setTimeout(() => bbEmit({ t: 'flash', text: pick(PRAISE), act: bb.act }), 1200);
}

function closeOrderTimeout() {
  if (bb.phase !== 'order_open') return;
  bb.phase = 'announce';
  clearInterval(bb.groupTick);
  penalizeAll();
  bbEmit({ t: 'flash', text: pick(SCOLD), act: bb.act });
  bbSchedule(5500, () => openAct(bb.act + 1));
}

// ------------------------------- CHORES ------------------------------------
function randomWalkableSpots(roomId, n) {
  const room = ROOMS.find(r => r.id === roomId);
  if (!room) return [];
  const cell = CELL;
  const cells = [];
  const c0 = Math.ceil((room.x + 20) / cell), c1 = Math.floor((room.x + room.w - 20) / cell);
  const r0 = Math.ceil((room.y + 20) / cell), r1 = Math.floor((room.y + room.h - 20) / cell);
  for (let ry = r0; ry <= r1; ry++) {
    for (let rx = c0; rx <= c1; rx++) {
      if (walkGrid[ry * cols + rx] === 1) cells.push([rx, ry]);
    }
  }
  shuffle(cells);
  return cells.slice(0, n).map(([cx, cy]) => ({ x: cx * cell + cell / 2, y: cy * cell + cell / 2 }));
}

function startChore() {
  const chore = pop('chore');
  bb.chore = chore;
  bb.choreClean = new Map();
  bb.spotsCleaned = 0;
  bb.phase = 'announce';
  bb.announceAt = Date.now();
  bbEmit({ t: 'announce', text: pick(CHORE_INTROS), act: bb.act });
  bbEmit({ t: 'announce', text: chore.text, act: bb.act });
  bbSchedule(ACT.ANNOUNCE, () => openChore());
}

function openChore() {
  const room = ROOMS.find(r => r.id === bb.chore.room);
  const spots = randomWalkableSpots(bb.chore.room, bb.chore.n);
  bb.phase = 'chore_open';
  bb.timeMs = ACT.CHORE_MS;
  bb.deadline = Date.now() + bb.timeMs;
  bb.choreClean = new Map();
  bb.choreTotal = spots.length;
  bb.choreSpots = spots.map((s, i) => ({ id: `${bb.act}:s${i}`, x: s.x, y: s.y, by: null }));
  bbEmit({ t: 'chore', room: { id: room.id, name: room.name }, spotCount: spots.length, spots: bb.choreSpots, timeMs: bb.timeMs, deadlineAt: bb.deadline, act: bb.act, guide: CHORE_GUIDE });
  attendBonus((x, y) => playerRoomId(x, y) === bb.chore.room, `Cleaning crew on site`);
  bbSchedule(bb.timeMs, () => closeChore());
}

function closeChore() {
  if (bb.phase !== 'chore_open') return;
  bb.phase = 'announce';
  const done = bb.spotsCleaned || 0;
  let champ = null;
  for (const [id, n] of bb.choreClean) {
    if (!champ || n > champ.n) champ = { id, n };
  }
  let explain = pick(CHORE_PRAISE);
  if (champ && champ.n > 0) {
    grant(champ.id, POINTS.choreChamp, true);
    setTimeout(() => bbEmit({ t: 'flash', text: CHORE_CHAMP(players.get(champ.id)?.name || '?'), act: bb.act }), 900);
    explain = `\u{1F451} ${players.get(champ.id)?.name} cleaned ${champ.n}/${bb.choreTotal} spots \u2014 champ bonus included.`;
  }
  bbEmit({ t: 'reveal', correct: 'Housework done', explain, scores: leaderboard(), act: bb.act });
  if (bb.spotsCleaned === 0) {
    penalizeAll();
  }
  bb.spotsCleaned = 0;
  bbSchedule(6000, () => openAct(bb.act + 1));
}

// ------------------------------- COOKING -----------------------------------
function startCook() {
  const dish = pop('dish');
  bb.dish = dish;
  bb.phase = 'announce';
  bb.announceAt = Date.now();
  bbEmit({ t: 'announce', text: pick(COOK_INTROS), act: bb.act });
  bbSchedule(ACT.ANNOUNCE, () => openCook());
}

function openCook() {
  const dish = bb.dish;
  bb.phase = 'cook_open';
  bb.timeMs = ACT.COOK_MS;
  bb.deadline = Date.now() + bb.timeMs;
  const itemKeys = Object.keys(COOK_ITEMS);
  const decoys = shuffle(itemKeys.filter(k => !dish.req.includes(k))).slice(0, 8);
  const pool = shuffle([...new Set([...dish.req, ...decoys])]);
  const stations = shuffle(COOK_STATIONS).slice(0, pool.length);
  bb.itemAt = new Map();
  bb.cookItems = [];
  pool.forEach((it, i) => {
    const id = `${bb.act}:i${i}`;
    const [sx, sy] = stations[i];
    bb.itemAt.set(id, { item: it, x: sx, y: sy, takenBy: null, by: null, id });
    bb.cookItems.push({ id, item: it, detail: COOK_ITEMS[it], x: sx, y: sy, takenBy: null });
  });
  for (const p of players.values()) p.carried = [];
  bbEmit({ t: 'cook', dish: { id: dish.id, name: dish.name, emoji: dish.emoji }, items: bb.cookItems, spot: COOK_SPOT, timeMs: bb.timeMs, deadlineAt: bb.deadline, act: bb.act, guide: COOK_GUIDE });
  attendBonus((x, y) => playerRoomId(x, y) === 'kitchen', `Chefs at the stove already`);
  bbSchedule(bb.timeMs, () => closeCook());
}

function closeCook() {
  if (bb.phase !== 'cook_open') return;
  bb.phase = 'announce';
  let explain = pick(COOK_PRAISE);
  if (!bb.dishesCooked) { bb.dishesCooked = 0; }
  if (bb.dishesCooked === 0) {
    penalizeAll();
    explain = pick(COOK_SCOLD);
  }
  bbEmit({ t: 'reveal', correct: `${bb.dish.emoji} ${bb.dish.name}`, explain, scores: leaderboard(), act: bb.act });
  bb.dishesCooked = 0;
  for (const p of players.values()) p.carried = [];
  bbSchedule(6000, () => openAct(bb.act + 1));
}

function tryCook(p, socket, spot) {
  const req = [...bb.dish.req];
  const have = new Set(p.carried || []);
  if (req.every(k => have.has(k))) {
    const pts = POINTS.correct + bonusFast();
    grant(p.id, pts);
    bb.dishesCooked = (bb.dishesCooked || 0) + 1;
    p.carried = [];
    bbEmit({ t: 'cook_update', id: null, carried: [] });
    bbEmit({ t: 'flash', text: `${bb.dish.emoji} ${p.name} cooked ${bb.dish.name}! +${pts} coins \u{1F44F}`, act: bb.act });
    socket.emit('bb', { t: 'feedback', ok: true, text: `\u{1F372} ${bb.dish.name} is ready! +${pts} coins` });
  } else {
    p.carried = [];
    bbEmit({ t: 'cook_update', id: null, carried: [] });
    socket.emit('bb', { t: 'feedback', ok: false, text: 'Wrong ingredients! I dumped your plates \u2014 find the dish\u2019s real items.' });
  }
}

// -------------------------------- GAMES ------------------------------------
function startGame() {
  const n = Math.max(1, bb.act / 4);
  const mode = MODES[(n - 1) % MODES.length];
  bb.mode = mode;
  bb.item = pop(mode);
  bb.phase = 'announce';
  bb.announceAt = Date.now();
  bbEmit({ t: 'announce', text: pick(INTROS[mode]), act: bb.act });
  bbSchedule(ACT.ANNOUNCE, () => openGame());
}

function openGame() {
  const mode = bb.mode, item = bb.item;
  bb.phase = 'game_open';
  bb.answered = new Set();
  bb.timeMs = ACT.GAME_MS[mode];
  bb.deadline = Date.now() + bb.timeMs;
  const payload = { mode, category: MODE_LABEL[mode], round: bb.act, timeMs: bb.timeMs, deadlineAt: bb.deadline };
  if (mode === 'word') {
    const sc = scrambleWord(item.title || item.answer);
    payload.q = item.q;
    payload.hint = item.hint;
    payload.kind = item.kind;
    payload.display = item.kind === 'anagram' ? sc.display : (item.pattern || item.chips);
    payload.len = item.kind === 'anagram' ? sc.len : null;
    payload.progress = item.progress || null;
  } else {
    payload.q = item.q;
    if (mode === 'picture') payload.emoji = item.emoji;
    payload.options = item.options;
  }
  bb.questionPayload = payload;
  bbEmit({ t: 'question', ...payload });
  attendBonus((x, y) => pointInArena(x, y), `The Task Arena is LIVE`);
  bbSchedule(bb.timeMs, () => closeGame());
}

function closeGame() {
  if (bb.phase !== 'game_open') return;
  bb.phase = 'announce';
  const item = bb.item;
  const correct = bb.mode === 'word' ? item.answer : item.options[item.a];
  bbEmit({ t: 'reveal', correct, explain: item.fact || '', scores: leaderboard(), act: bb.act });
  if (bb.answered.size === 0) {
    bbEmit({ t: 'flash', text: REVEAL_FAIL_USERS('the house'), act: bb.act });
  }
  bbSchedule(ACT.GAME_REVEAL, () => openAct(bb.act + 1));
}

// ------------------------------ SEQUENCE -----------------------------------
function actType(n) {
  return ACT.ACT_SEQ[(n - 1) % ACT.ACT_SEQ.length];
}

function openAct(n) {
  bb.act = n;
  bb.phase = 'announce';
  const t = actType(n);
  if (t === 'order') startOrder();
  else if (t === 'chore') startChore();
  else if (t === 'cook') startCook();
  else startGame();
}

function startBB() {
  setTimeout(() => {
    bbEmit({ t: 'announce', text: pick(WELCOMES), act: 0 });
    bbSchedule(ACT.WELCOME + ACT.ANNOUNCE, () => openAct(1));
  }, 900);
}

// --------------------------------------------------------------------------
// Socket handlers
// --------------------------------------------------------------------------
io.on('connection', (socket) => {
  if (players.size >= MAX_PLAYERS) {
    socket.emit('error', { message: 'The house is full right now. Try again in a while.' });
    socket.disconnect(true);
    return;
  }

  // ------------------------------- LOGIN ---------------------------------
  socket.on('login', ({ name, color, passcode } = {}) => {
    if (socket.player) return;

    let cleanName = String(name || '').trim().slice(0, MAX_NAME_LEN);
    if (!cleanName) cleanName = 'Housemate';
    const pass = String(passcode || '');
    if (HOUSE_PASSCODE && pass !== HOUSE_PASSCODE) {
      socket.emit('login_denied', { message: HOUSE_PASSCODE
        ? `Wrong passcode. Hint: the season 8 tagline word.`
        : 'The house is closed.' });
      return;
    }
    const color2 = /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffb703';

    const player = {
      id: socket.id,
      name: cleanName,
      color: color2,
      x: SPAWN.x,
      y: SPAWN.y,
      face: 's',
      moving: false,
      anim: 0,
      room: getRoom(SPAWN.x, SPAWN.y),
      onlineAt: Date.now(),
      lastSeen: Date.now(),
      lastChat: 0,
      carried: [],
    };

    socket.player = player;
    players.set(socket.id, player);
    socket.emit('logged_in', publicPlayer(player));
    const crowd = [...players.values()].map(publicPlayer);
    io.to(socket.id).emit('players', crowd);
    socket.emit('system', {
      text: `Enter the Bigg Boss house, ${player.name}. The eye is watching.`,
      ts: Date.now(),
    });
    io.emit('system', {
      text: `${player.name} entered the house.`,
      ts: Date.now(),
    });
    socket.emit('bb', syncPayload());
    broadcastPlayers();
  });

  // ------------------------------ MOVEMENT -------------------------------
  socket.on('move', (m = {}) => {
    const p = socket.player;
    if (!p) return;
    const now = Date.now();
    if (now - p.lastSeen < MOVE_THROTTLE) return;
    p.lastSeen = now;

    const x = Number(m.x), y = Number(m.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.abs(x - p.x) > 400 || Math.abs(y - p.y) > 400) return; // anti-teleport

    p.x = Math.max(20, Math.min(WORLD.w - 20, x));
    p.y = Math.max(20, Math.min(WORLD.h - 20, y));
    p.face = /^[nsew]$/.test(m.face || '') ? m.face : p.face;
    p.moving = !!m.moving;
    const roomNow = pointInRoom(p.x, p.y);
    const name = roomNow.name;
    if (name !== p.room) {
      p.room = name;
      io.emit('room', { id: p.id, name, ts: Date.now() });
    }
  });

  // ------------------------------- CHAT ----------------------------------
  socket.on('chat', ({ text } = {}) => {
    const p = socket.player;
    if (!p) return;
    const now = Date.now();
    if (p.lastChat && now - p.lastChat < CHAT_COOLDOWN) {
      socket.emit('chat_cooldown', { ms: CHAT_COOLDOWN - (now - p.lastChat) });
      return;
    }
    p.lastChat = now;

    let msg = String(text || '').slice(0, MAX_CHAT_LEN);
    if (!msg.trim()) return;

    // Word-round: Bigg Boss listens to yells from within the arena.
    if (bb.phase === 'game_open' && bb.mode === 'word'
        && !bb.answered.has(p.id) && pointInArena(p.x, p.y)
        && checkWord(msg, bb.item.accepts)) {
      bb.answered.add(p.id);
      const pts = POINTS.correct + POINTS.shout + bonusFast();
      grant(p.id, pts);
      socket.emit('bb', { t: 'feedback', ok: true, points: pts, text: '\u{1F50A} Bigg Boss heard your yell!' });
      bbEmit({ t: 'flash', text: `\u{1F50A} ${p.name} SHOUTED the answer from the arena! +${pts} coins`, act: bb.act });
    }

    const msgId = `${socket.id}:${now}`;
    const payload = {
      id: msgId,
      sender: p.id,
      name: p.name,
      color: p.color,
      text: msg,
      x: p.x,
      y: p.y,
      ts: now,
    };

    for (const [id, other] of players) {
      if (id === socket.id) continue;
      const dx = other.x - p.x;
      const dy = other.y - p.y;
      if (Math.hypot(dx, dy) <= CHAT_RADIUS) {
        io.to(id).emit('chat', payload);
      }
    }
    socket.emit('chat_self', payload);
  });

  // -------------------------- PRIVATE CHAT (whisper) ---------------------
  // Personal one-on-one text chat: only works with a player standing right
  // next to you, and the message reaches ONLY them (no matter who else is
  // nearby).
  socket.on('chat_priv', ({ to, text } = {}) => {
    const p = socket.player;
    if (!p) return;
    const now = Date.now();
    if (p.lastChat && now - p.lastChat < CHAT_COOLDOWN) {
      socket.emit('chat_cooldown', { ms: CHAT_COOLDOWN - (now - p.lastChat) });
      return;
    }
    p.lastChat = now;

    let msg = String(text || '').slice(0, MAX_CHAT_LEN);
    if (!msg.trim()) return;
    if (!to || !players.has(to)) {
      socket.emit('bb', { t: 'feedback', ok: false, text: 'That player is no longer here.' });
      return;
    }
    const other = players.get(to);
    if (other.id === p.id) return;
    if (Math.hypot(other.x - p.x, other.y - p.y) > CHAT_RADIUS) {
      socket.emit('bb', { t: 'feedback', ok: false, text: `${other.name} walked away. Walk closer to whisper.` });
      return;
    }

    const payload = {
      id: `${socket.id}:${now}`,
      sender: p.id,
      name: p.name,
      color: p.color,
      text: msg,
      to: other.id,
      toName: other.name,
      whisper: true,
      x: p.x,
      y: p.y,
      ts: now,
    };
    io.to(to).emit('chat', payload);
    socket.emit('chat_self', payload);
  });

  // ------------------------------ GAME ANSWER ----------------------------
  // One shot per round, must stand inside the Task Arena.
  socket.on('quiz_answer', ({ answer } = {}) => {
    const p = socket.player;
    if (!p) return;
    if (bb.phase !== 'game_open') return;
    if (bb.answered.has(p.id)) return;
    if (!pointInArena(p.x, p.y)) {
      socket.emit('bb', { t: 'feedback', ok: false, text: 'You must stand inside the TASK ARENA to answer!' });
      return;
    }
    let ok = false;
    if (bb.mode === 'word') {
      ok = typeof answer === 'string' && answer.trim().length > 1 && checkWord(answer, bb.item.accepts);
    } else {
      const i = Number(answer);
      ok = Number.isInteger(i) && i >= 0 && i < bb.item.options.length && i === bb.item.a;
    }
    if (ok) {
      bb.answered.add(p.id);
      const pts = POINTS.correct + bonusFast();
      grant(p.id, pts);
      socket.emit('bb', { t: 'feedback', ok: true, points: pts, text: `Correct! +${pts} coins` });
      bbEmit({ t: 'flash', text: `${p.name} got it! ${pick(GAME_CORRECT)} +${pts} coins`, act: bb.act });
    } else {
      socket.emit('bb', { t: 'feedback', ok: false, text: pick(SCOLD) });
    }
  });

  // ------------------------------ CHORE CLEAN ----------------------------
  socket.on('chore_interact', () => {
    const p = socket.player;
    if (!p) return;
    if (bb.phase !== 'chore_open') return;
    if (playerRoomId(p.x, p.y) !== bb.chore.room) {
      socket.emit('bb', { t: 'feedback', ok: false, text: 'The dirt is somewhere else!' });
      return;
    }
    let best = null, bd = 52;
    for (const s of bb.choreSpots) {
      if (s.by) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) { bd = d; best = s; }
    }
    if (!best) {
      socket.emit('bb', { t: 'feedback', ok: false, text: 'No grime left near you!' });
      return;
    }
    best.by = { name: p.name, color: p.color };
    bb.choreClean.set(p.id, (bb.choreClean.get(p.id) || 0) + 1);
    bb.spotsCleaned = (bb.spotsCleaned || 0) + 1;
    grant(p.id, POINTS.chore);
    socket.emit('bb', { t: 'feedback', ok: true, text: `\u{2728} Spot cleaned! +${POINTS.chore} coins` });
    bbEmit({ t: 'chore_update', id: best.id, by: { name: p.name, color: p.color } });
    if (bb.spotsCleaned >= bb.choreTotal) {
      clearTimeout(bb.timer);
      closeChore();
    }
  });

  // ------------------------------ COOK INTERACT --------------------------
  socket.on('cook_interact', () => {
    const p = socket.player;
    if (!p) return;
    if (bb.phase !== 'cook_open') return;
    if (playerRoomId(p.x, p.y) !== 'kitchen') {
      socket.emit('bb', { t: 'feedback', ok: false, text: 'This is not the kitchen!' });
      return;
    }
    const spt = COOK_SPOT;
    let best = null, bd = 52;
    for (const [, a] of bb.itemAt) {
      if (a.takenBy) continue;
      const d = Math.hypot(p.x - a.x, p.y - a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (best) {
      best.takenBy = p.id;
      best.by = { name: p.name, color: p.color };
      p.carried.push(best.item);
      bbEmit({ t: 'cook_update', id: best.id, takenBy: p.name });
      socket.emit('bb', { t: 'carried', carried: [...p.carried] });
      socket.emit('bb', { t: 'feedback', ok: true, text: `Grabbed ${COOK_ITEMS[best.item].name} ${COOK_ITEMS[best.item].e}` });
      return;
    }
    if (Math.hypot(p.x - spt.x, p.y - spt.y) <= spt.r) {
      tryCook(p, socket, spt);
      return;
    }
    socket.emit('bb', { t: 'feedback', ok: false, text: 'Nothing to grab nearby.' });
  });

  // ------------------------------- COOK DROP -----------------------------
  socket.on('cook_drop', () => {
    const p = socket.player;
    if (!p || bb.phase !== 'cook_open') return;
    if (playerRoomId(p.x, p.y) !== 'kitchen') return;
    p.carried = [];
    socket.emit('bb', { t: 'carried', carried: [] });
    socket.emit('bb', { t: 'feedback', ok: true, text: 'Dropped everything you carried.' });
  });

  // --------------------------- BB STATE RE-SYNC --------------------------
  socket.on('bb_sync', () => {
    if (!socket.player) return;
    socket.emit('bb', syncPayload());
  });

  // -------------------------- VOICE CHAT RELAY ---------------------------
  // WebRTC media flows peer-to-peer between browsers; the server only
  // relays offer/answer/ICE signalling and hold-to-talk on/off state.
  socket.on('v_sig', ({ to, data } = {}) => {
    if (!socket.player || !to || !data || typeof to !== 'string') return;
    if (data.sdp && typeof data.sdp !== 'object') return;
    if (data.ice && typeof data.ice !== 'object') return;
    const target = io.sockets.sockets.get(to);   // relay to whoever is connected
    if (!target) return;
    target.emit('v_sig', { from: socket.id, data });
  });
  socket.on('v_on', () => {
    if (!socket.player) return;
    io.emit('v_on', { id: socket.id });
  });
  socket.on('v_off', () => {
    if (!socket.player) return;
    io.emit('v_off', { id: socket.id });
  });

  // ----------------------------- DISCONNECT ------------------------------
  socket.on('disconnect', () => {
    const p = players.get(socket.id);
    if (!p) return;
    players.delete(socket.id);
    bb.coins.delete(socket.id);
    for (const [, a] of bb.itemAt) {
      if (a.takenBy === socket.id) { a.takenBy = null; a.by = null; }
    }
    io.emit('system', { text: `${p.name} left the house.`, ts: Date.now() });
    io.emit('player_left', { id: socket.id });
  });
});

server.listen(port, () => {
  console.log(`🏠 Bigg Boss House server running on http://localhost:${port}`);
  startBB();
});
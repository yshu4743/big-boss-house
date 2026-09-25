import { buildGrid, CELL, pointInRoom } from '../../../shared/map.js';
import { MOVE_THROTTLE, BUBBLE_MS } from '../../../shared/config.js';
import { drawWorld } from './render.js';
import { playPing, playOwn, playSystem, playFootstep, playBB, playCorrect, playWrong, playCoin } from './sound.js';

const SPEED = 265;
const RADIUS = 13;

export class GameEngine {
  constructor(canvas, socket, me, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.socket = socket;
    this.callbacks = callbacks;
    this.grid = buildGrid();

    this.players = new Map();
    this.me = { ...me, tx: me.x, ty: me.y, anim: 0, alive: true };
    this.players.set(me.id, this.me);

    this.bubbles = [];
    this.room = pointInRoom(me.x, me.y).name;
    this.cam = { x: me.x, y: me.y };
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.lastMove = 0;
    this.lastStep = 0;
    this.cookItems = null;
    this.choreSpots = null;
    this.bbCook = false;            // stove lit while the cook act runs
    this.interact = null;   // 'cook' | 'chore' | null
    this.carried = [];
    this.disposed = false;
    this.raf = 0;
    this.last = performance.now();
    this.cloudBase = [120, 900, 1700, 640];
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.scale = 1;

    this._bindEvents();
    this._bindInput();
    this._resize();
    window.addEventListener('resize', this._resize);
    this._loop();
  }

  // ------------------------------------------------------------- socket
  _bindEvents() {
    const s = this.socket;
    s.on('players', (list) => {
      for (const p of list) {
        if (p.id === this.me.id) continue;
        const cur = this.players.get(p.id);
        if (cur) {
          cur.tx = p.x; cur.ty = p.y;
          cur.face = p.face; cur.moving = p.moving;
          cur.room = p.room; cur.name = p.name; cur.color = p.color;
        } else {
          this.players.set(p.id, { ...p, x: p.x, y: p.y, tx: p.x, ty: p.y, anim: 0 });
        }
      }
      // prune ghosts
      const ids = new Set(list.map((p) => p.id)); ids.add(this.me.id);
      for (const id of this.players.keys()) if (!ids.has(id)) this.players.delete(id);
      this.callbacks.onPlayers?.([...this.players.values()]);
    });

    s.on('chat', (payload) => {
      this._spawnBubble(payload);
      this.callbacks.onChat?.(payload);
      playPing();
    });
    s.on('chat_self', (payload) => {
      this._spawnBubble(payload);
      this.callbacks.onChat?.(payload);
      playOwn();
    });
    s.on('system', (payload) => {
      this.callbacks.onSystem?.(payload);
      playSystem();
    });
    s.on('room', ({ id, name }) => {
      if (id === this.me.id) {
        this.room = name;
        this.callbacks.onRoom?.(name);
      } else {
        const cur = this.players.get(id);
        if (cur) cur.room = name;
      }
    });
    s.on('chat_cooldown', ({ ms }) => {
      this.callbacks.onCooldown?.(ms);
    });
    s.on('bb', (ev) => this._onBB(ev));
    s.on('player_left', ({ id }) => {
      this.players.delete(id);
      this.callbacks.onPlayers?.([...this.players.values()]);
    });
    s.on('disconnect', () => this.callbacks.onStatus?.(false));
    s.on('reconnect', () => this.callbacks.onStatus?.(true));
    s.on('connect', () => this.callbacks.onStatus?.(true));
  }

  _spawnBubble(payload) {
    let idx = this.bubbles.findIndex((b) => b.sender === payload.sender);
    const bubble = {
      sender: payload.sender,
      text: payload.text,
      born: Date.now(),
    };
    if (idx >= 0) this.bubbles[idx] = bubble;
    else this.bubbles.push(bubble);
    if (this.bubbles.length > 12) this.bubbles.shift();
  }

  _onBB(ev) {
    switch (ev.t) {
      case 'cook':
        this.cookItems = new Map((ev.items || []).map((i) => [i.id, { ...i }]));
        this.interact = 'cook';
        break;
      case 'cook_update':
        if (this.cookItems && ev.id && this.cookItems.has(ev.id)) {
          const it = this.cookItems.get(ev.id);
          it.takenBy = ev.takenBy || null;
        }
        break;
      case 'carried':
        this.carried = ev.carried ? [...ev.carried] : [];
        break;
      case 'chore':
        this.choreSpots = new Map((ev.spots || []).map((s) => [s.id, { ...s }]));
        this.interact = 'chore';
        break;
      case 'chore_update':
        if (this.choreSpots && this.choreSpots.has(ev.id)) this.choreSpots.delete(ev.id);
        break;
      case 'announce':
      case 'reveal':
        this.cookItems = null;
        this.choreSpots = null;
        this.interact = null;
        break;
      default:
        break;
    }
    switch (ev.t) {
      case 'announce': playBB(); break;
      case 'reveal': playBB(); break;
      case 'score': playCoin(); break;
      case 'group': playSystem(); break;
      case 'feedback': ev.ok ? playCorrect() : playWrong(); break;
      default: break;
    }
    this.callbacks.onBB?.(ev);
  }

  // ------------------------------------------------------------- input
  _bindInput() {
    this._onKeyDown = (e) => {
      const target = e.target;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (!typing) {
        if (e.key === 'e' || e.key === 'E') this._interact();
        if (e.key === 'r' || e.key === 'R') this.socket.emit('cook_drop');
      }
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
      this.keys.add(k);
      if (k === ' ' || k === 'enter') e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this._onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  _dir() {
    let x = 0, y = 0;
    const joyMag = Math.hypot(this.joy.x, this.joy.y);
    if (joyMag > 0.15) {
      x = this.joy.x;
      y = this.joy.y;
    } else {
      if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
      if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
      if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
      if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    }
    const len = Math.hypot(x, y);
    if (len === 0) return null;
    const m = Math.min(len, 1);
    return { x: (x / len) * m, y: (y / len) * m, mag: m };
  }

  _resize = () => {
    const rect = this.canvas.getBoundingClientRect();
    this.cw = rect.width;
    this.ch = rect.height;
    this.canvas.width = Math.round(rect.width * this.dpr);
    this.canvas.height = Math.round(rect.height * this.dpr);
  };

  // ------------------------------------------------------------- loop
  _loop = () => {
    if (this.disposed) return;
    this._raf = requestAnimationFrame(this._loop);
    const now = performance.now();
    let dt = (now - this.last) / 1000;
    this.last = now;
    dt = Math.min(dt, 0.05);

    this._update(dt);
    this._draw(now);
  };

  _update(dt) {
    const me = this.me;
    const dir = this._dir();

    let moved = false;
    if (dir) {
      const vx = dir.x * SPEED;
      const vy = dir.y * SPEED;
      const ox = me.x, oy = me.y;

      if (Math.abs(vx) > 0 && this._canPlace(me.x + vx * dt, me.y)) me.x += vx * dt;
      if (Math.abs(vy) > 0 && this._canPlace(me.x, me.y + vy * dt)) me.y += vy * dt;

      moved = me.x !== ox || me.y !== oy;
      if (moved) {
        if (Math.abs(vx) > Math.abs(vy)) me.face = vx > 0 ? 'e' : 'w';
        else me.face = vy > 0 ? 's' : 'n';
        me.anim += dt * 9;
      }
      me.moving = moved;
    } else {
      me.moving = false;
    }

    if (me.moving) {
      const t = Date.now();
      if (t - this.lastStep > 260) {
        this.lastStep = t;
        playFootstep();
      }
    }

    // throttle position sync to server
    const t = Date.now();
    if (t - this.lastMove >= MOVE_THROTTLE) {
      this.lastMove = t;
      this.socket.emit('move', { x: Math.round(me.x), y: Math.round(me.y), face: me.face, moving: me.moving });
      me.tx = me.x; me.ty = me.y;
    }

    // interpolate others
    const k = 1 - Math.exp(-dt * 12);
    for (const p of this.players.values()) {
      if (p === me) continue;
      p.x += (p.tx - p.x) * k;
      p.y += (p.ty - p.y) * k;
      if (p.moving) p.anim += dt * 9;
    }

    // camera
    const look = { n: [0, -14], s: [0, 10], e: [10, 0], w: [-10, 0] }[me.face] || [0, 8];
    const tx = me.x + look[0];
    const ty = me.y + look[1];
    const ck = 1 - Math.exp(-dt * 6);
    this.cam.x += (tx - this.cam.x) * ck;
    this.cam.y += (ty - this.cam.y) * ck;

    // prune stale bubbles
    const nowMs = Date.now();
    if (this.bubbles.length) this.bubbles = this.bubbles.filter((b) => nowMs - b.born < BUBBLE_MS);
  }

  _canPlace(x, y) {
    const { grid, cols } = this.grid;
    const r = RADIUS - 1;
    const pts = [[x - r, y - r], [x + r, y - r], [x - r, y + r], [x + r, y + r], [x, y]];
    const cell = CELL;
    for (const [px, py] of pts) {
      const cx = Math.floor(px / cell);
      const cy = Math.floor(py / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= (this.grid.rows)) return false;
      if (grid[cy * cols + cx] !== 1) return false;
    }
    return true;
  }

  _draw(now) {
    const ctx = this.ctx;
    const { cw, ch, dpr } = this;
    const s = Math.max(0.5, Math.min(cw / 1100, ch / 720));

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#10130d';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    const cx = cw / 2 - this.cam.x * s;
    const cy = ch / 2 - this.cam.y * s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * cx, dpr * cy);

    drawWorld(ctx, {
      players: this.players,
      meId: this.me.id,
      bubbles: this.bubbles,
      time: now,
      cloudBase: this.cloudBase,
      cookItems: this.cookItems,
      choreSpots: this.choreSpots,
      stoveLit: this.bbCook,
    });

    // post-processing: warm light + vignette
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(8,10,6,0.34)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    const warm = (Math.sin(now * 0.0004) * 0.5 + 0.5) * 0.03;
    ctx.fillStyle = `rgba(255,190,90,${warm.toFixed(3)})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // ------------------------------------------------------------- api
  sendChat(text, privTo) {
    const msg = String(text).slice(0, 220).trim();
    if (!msg) return;
    if (privTo) this.socket.emit('chat_priv', { to: privTo, text: msg });
    else this.socket.emit('chat', { text: msg });
  }

  _interact() {
    if (!this.interact) return;
    if (this.interact === 'cook') this.socket.emit('cook_interact');
    else if (this.interact === 'chore') this.socket.emit('chore_interact');
  }

  setJoystick(x, y) {
    this.joy.x = x;
    this.joy.y = y;
  }

  act() {
    this._interact();
  }

  drop() {
    this.socket.emit('cook_drop');
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this._raf);
    window.removeEventListener('resize', this._resize);
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.socket.off('players');
    this.socket.off('chat');
    this.socket.off('chat_self');
    this.socket.off('system');
    this.socket.off('room');
    this.socket.off('chat_cooldown');
    this.socket.off('bb');
    this.socket.off('player_left');
    this.socket.off('disconnect');
    this.socket.off('reconnect');
    this.socket.off('connect');
  }
}
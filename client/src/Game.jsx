import { useEffect, useMemo, useRef, useState } from 'react';
import { GameEngine } from './game/engine.js';
import { playChatOpen, soundState } from './game/sound.js';
import { CHAT_RADIUS } from '../../shared/config.js';
import { BiggBossDesk } from './Quiz.jsx';
import { MobileControls } from './MobileControls.jsx';

const LOG_LIMIT = 40;

export function Game({ socket, me, onLeave }) {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const chatInputRef = useRef(null);
  const [players, setPlayers] = useState([]);
  const [log, setLog] = useState([]);
  const [room, setRoom] = useState('Central Garden');
  const [toast, setToast] = useState(null);
  const [online, setOnline] = useState(1);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState('');
  const [soundOn, setSoundOn] = useState(soundState.enabled);
  const [conn, setConn] = useState(true);
  const [whisperTo, setWhisperTo] = useState(null);
  const [whisperName, setWhisperName] = useState(null);
  const [myCoins, setMyCoins] = useState(0);
  const [isTouch] = useState(() =>
    typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window));
  const [showPlayers, setShowPlayers] = useState(() => !isTouch);
  const [showDesk, setShowDesk] = useState(() => !isTouch);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current, socket, me, {
      onPlayers: (list) => { setPlayers(list); setOnline(list.length); },
      onChat: (payload) => {
        setLog((prev) => [...prev.slice(-LOG_LIMIT), payload]);
      },
      onSystem: (payload) => {
        setLog((prev) => [...prev.slice(-LOG_LIMIT), { ...payload, system: true }]);
      },
      onRoom: (name) => {
        setRoom(name);
        setToast({ name, ts: Date.now() });
      },
      onCooldown: (ms) => setCooldown(ms),
      onStatus: (ok) => setConn(ok),
      onBB: (ev) => {
        if (ev.t === 'cook') engine.bbCook = true;
        if (ev.t === 'reveal') engine.bbCook = false;
        if (ev.t === 'syn') engine.bbCook = ev.phase === 'cook_open';
        if (ev.t === 'score' && ev.id === me.id) setMyCoins(ev.coins);
        if (ev.t === 'syn') {
          const mine = (ev.scores || []).find((s) => s.id === me.id);
          if (mine) setMyCoins(mine.coins);
        }
      },
    });
    engineRef.current = engine;
    return () => engine.dispose();
  }, [socket, me]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const send = (e) => {
    e.preventDefault();
    const text = msg.trim();
    if (!text) return;
    engineRef.current?.sendChat(text, whisperTo);
    setMsg('');
    setCooldown(0);
  };

  const hint = useMemo(
    () => 'WASD / Arrow keys to move · Enter to talk · E to act · R to drop',
    []
  );

  const myDist = (p) => {
    const me2 = engineRef.current?.me;
    if (!me2) return 0;
    return Math.hypot(p.x - me2.x, p.y - me2.y);
  };

  const nearby = players
    .filter((p) => p.id !== me.id && myDist(p) <= CHAT_RADIUS)
    .sort((a, b) => myDist(a) - myDist(b));
  const nearest = nearby[0] || null;

  const toggleWhisper = () => {
    if (whisperTo) {
      setWhisperTo(null);
      setWhisperName(null);
    } else if (nearest) {
      setWhisperTo(nearest.id);
      setWhisperName(nearest.name);
    }
  };

  useEffect(() => {
    if (!nearest) {
      setWhisperTo(null);
      setWhisperName(null);
    } else if (whisperTo && whisperTo !== nearest.id) {
      setWhisperTo(nearest.id);
      setWhisperName(nearest.name);
    }
  }, [nearest?.id]);

  return (
    <div className="game-root">
      <canvas ref={canvasRef} className="game-canvas" />

      {/* Top HUD */}
      <header className="hud-top">
        <div className="hud-brand">
          <span className="eye-mini" />
          <b>BIGG BOSS HOUSE</b>
          <span className="hud-tag">S8 · Democracy</span>
        </div>
        <div className="hud-mid">
          <div className="hud-room">
            <span className="pulse-dot" />
            {room}
          </div>
        </div>
        <div className="hud-right">
          <span className="online-pill">👥 {online} in house</span>
          <button
            className="icon-btn"
            title={soundOn ? 'Sound on' : 'Sound off'}
            onClick={() => { const v = !soundOn; soundState.enabled = v; setSoundOn(v); }}
          >
            {soundOn ? '🔊' : '🔇'}
          </button>
          <button className="leave-btn" onClick={onLeave}>Exit</button>
        </div>
      </header>

      {/* Players sidebar */}
      <button
        type="button"
        className={`touch-only toggle toggle-players${showPlayers ? ' on' : ''}`}
        onClick={() => setShowPlayers((v) => !v)}
        aria-label={showPlayers ? 'Hide housemates' : 'Show housemates'}
      >
        {showPlayers ? '✕' : '🫂'}
      </button>
      <aside className={`hud-players${showPlayers ? ' open' : ''}`}>
        <div className="hud-players-title">Housemates</div>
        <ul>
          {players.map((p) => {
            const d = myDist(p);
            const isMe = p.id === me.id;
            return (
              <li key={p.id} className={isMe ? 'me' : ''}>
                <span className="dot" style={{ background: p.color }} />
                <span className="pname">{p.name}{isMe ? ' (you)' : ''}</span>
                <span className="proom">{p.room}</span>
                <span className="pdist">
                  {isMe ? '—' : d <= CHAT_RADIUS ? `nearby · ${Math.round(d)}px` : `${Math.round(d)}px`}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Chat log */}
      <section className="hud-chat">
        {log.map((m, i) => {
          if (m.system) {
            return (
              <div key={i} className="chat-row system">
                <span>✦ {m.text}</span>
              </div>
            );
          }
          const self = m.sender === me.id;
          const priv = !!m.whisper;
          const rowCls = ['chat-row'];
          if (self) rowCls.push('self');
          if (priv) rowCls.push('whisper');
          return (
            <div key={i} className={rowCls.join(' ')}>
              <span className="cname" style={{ color: m.color }}>
                {priv ? '🔒 ' : ''}
                {self ? 'You' : m.name}
                {priv && self && m.toName ? ` → ${m.toName}` : ''}
              </span>
              <span className="ctext">{m.text}</span>
            </div>
          );
        })}
      </section>

      {/* Room change toast */}
      {toast && <div className="toast">Now entering — {toast.name}</div>}

      {!conn && <div className="conn-warning">Connection lost — trying to reconnect…</div>}

      {/* Controls hint */}
      {!log.length && (
        <div className="hint-banner">
          {hint} — voice bubbles appear over housemates who are close enough to talk.
        </div>
      )}

      {/* Chat input */}
      <form className="chat-bar" onSubmit={send}>
        <button
          type="button"
          className={`whisper-btn${whisperTo ? ' on' : ''}${nearest ? '' : ' off'}`}
          title={whisperTo
            ? `Whispering privately to ${whisperName} — press again to stop`
            : nearest
              ? `Talk privately with ${nearest.name} (stand close)`
              : 'No one is close enough to whisper to'}
          onClick={toggleWhisper}
        >
          {whisperTo ? '🔒' : '💬'}
        </button>
        <input
          ref={chatInputRef}
          value={msg}
          maxLength={220}
          placeholder={whisperTo
            ? `Whisper to ${whisperName}…`
            : cooldown > 0
              ? `Too fast, wait ${Math.ceil(cooldown / 1000)}s…`
              : 'Say something to housemates nearby…'}
          onChange={(e) => setMsg(e.target.value)}
          onFocus={() => playChatOpen()}
        />
        <button type="submit" disabled={!msg.trim()}>Speak</button>
      </form>

      <MobileControls engineRef={engineRef} />

      {showDesk && <BiggBossDesk socket={socket} me={me} myCoins={myCoins} onClose={isTouch ? () => setShowDesk(false) : undefined} />}
      <button
        type="button"
        className={`touch-only toggle toggle-desk${showDesk ? ' on' : ''}`}
        onClick={() => setShowDesk((v) => !v)}
        aria-label={showDesk ? 'Close Bigg Boss desk' : 'Open Bigg Boss desk'}
      >
        {showDesk ? '✕' : '👁 Bigg Boss'}
      </button>
    </div>
  );
}
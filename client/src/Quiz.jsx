import { useEffect, useRef, useState } from 'react';
import { COOK_ITEMS } from '../../shared/bb.js';

const PHASE_LABEL = {
  announce: 'Bigg Boss is speaking…',
  game_open: 'GAME ON',
  order_open: 'MAKE THE GROUP',
  chore_open: 'CLEANING EVENT',
  cook_open: 'KITCHEN TASK',
  idle: 'The Eye is Ready',
};

function fmtTime(ms) {
  if (!ms || ms < 0) ms = 0;
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function BiggBossDesk({ socket, me, myCoins, onClose }) {
  const [phase, setPhase] = useState('idle');
  const [act, setAct] = useState(0);
  const [announce, setAnnounce] = useState('');
  const [flash, setFlash] = useState('');
  const [question, setQuestion] = useState(null);
  const [order, setOrder] = useState(null);
  const [chore, setChore] = useState(null);
  const [cook, setCook] = useState(null);
  const [carried, setCarried] = useState([]);
  const [deadlineAt, setDeadlineAt] = useState(0);
  const [timeMs, setTimeMs] = useState(0);
  const [board, setBoard] = useState([]);
  const [grouped, setGrouped] = useState([]);
  const [spotsLeft, setSpotsLeft] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wordInput, setWordInput] = useState('');
  const [reveal, setReveal] = useState(null);
  const [now, setNow] = useState(Date.now());
  const feedRef = useRef(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const onBB = (ev) => {
      switch (ev.t) {
        case 'syn':
          setAct(ev.act || 0);
          setPhase(ev.phase || 'idle');
          setBoard(ev.scores || []);
          if (ev.phase === 'game_open' && ev.question) {
            setQuestion(ev.question);
            setDeadlineAt(ev.question.deadlineAt || 0);
            setTimeMs(ev.question.timeMs || 0);
            setAnswered(false);
          }
          if (ev.phase === 'order_open' && ev.order) {
            setOrder(ev.order);
            setDeadlineAt(ev.order.deadlineAt || 0);
            setTimeMs(ev.order.timeMs || 0);
          }
          if (ev.phase === 'chore_open' && ev.chore) {
            setChore(ev.chore);
            setSpotsLeft(ev.chore.spotCount || ev.chore.spots?.length || 0);
            setDeadlineAt(ev.chore.deadlineAt || 0);
            setTimeMs(ev.chore.timeMs || 0);
          }
          if (ev.phase === 'cook_open' && ev.cook) {
            setCook(ev.cook);
            setDeadlineAt(ev.cook.deadlineAt || 0);
            setTimeMs(ev.cook.timeMs || 0);
          }
          break;
        case 'announce':
          setAct(ev.act || 0);
          setPhase('announce');
          setFlash('');
          setAnnounce(ev.text || '');
          setQuestion(null);
          setOrder(null);
          setChore(null);
          setCook(null);
          setDeadlineAt(0);
          setReveal(null);
          break;
        case 'question':
          setPhase('game_open');
          setAnnounce(ev.category || '');
          setQuestion(ev);
          setDeadlineAt(ev.deadlineAt || 0);
          setTimeMs(ev.timeMs || 0);
          setAnswered(false);
          setReveal(null);
          break;
        case 'order':
          setPhase('order_open');
          setOrder(ev);
          setAnnounce(ev.text || '');
          setDeadlineAt(ev.deadlineAt || 0);
          setTimeMs(ev.timeMs || 0);
          setGrouped([]);
          setReveal(null);
          break;
        case 'group':
          setGrouped(ev.formed || []);
          break;
        case 'chore':
          setPhase('chore_open');
          setChore(ev);
          setAnnounce(ev.room?.name || '');
          setSpotsLeft(ev.spotCount || ev.spots?.length || 0);
          setDeadlineAt(ev.deadlineAt || 0);
          setTimeMs(ev.timeMs || 0);
          setReveal(null);
          break;
        case 'chore_update':
          setSpotsLeft((n) => Math.max(0, n - 1));
          break;
        case 'cook':
          setPhase('cook_open');
          setCook(ev);
          setAnnounce(ev.dish?.name || '');
          setDeadlineAt(ev.deadlineAt || 0);
          setTimeMs(ev.timeMs || 0);
          setReveal(null);
          break;
        case 'carried':
          setCarried(ev.carried || []);
          break;
        case 'reveal':
          setPhase('announce');
          setAnswered(false);
          setReveal(ev);
          setFlash(ev.explain || '');
          break;
        case 'flash':
          setFlash(ev.text || '');
          break;
        case 'score':
          setBoard(ev.scores || board);
          break;
        default:
          break;
      }
    };
    socket.on('bb', onBB);
    socket.emit('bb_sync');
    return () => socket.off('bb', onBB);
  }, [socket]);

  const left = Math.max(0, deadlineAt - now);
  const pct = timeMs > 0 ? Math.min(100, Math.max(0, (left / timeMs) * 100)) : 0;

  const answer = (i) => {
    if (answered) return;
    setAnswered(true);
    socket.emit('quiz_answer', { answer: i });
  };
  const submitWord = (e) => {
    e.preventDefault();
    if (answered) return;
    if (!wordInput.trim()) return;
    setAnswered(true);
    socket.emit('quiz_answer', { answer: wordInput.trim() });
  };

  const meCoins = myCoins !== undefined
    ? myCoins
    : (board.find((s) => s.id === me.id)?.coins ?? 0);

  return (
    <aside className="bb-desk">
      <div className="bb-desk-head">
        <span className="eye-mini" />
        <div>
          <b>BIGG BOSS</b>
          <span className="bb-act">Act {act} · {PHASE_LABEL[phase] || phase}</span>
        </div>
        <span className="bb-coins" title="Your coins">🪙 {meCoins}</span>
        {onClose && (
          <button type="button" className="desk-close touch-only" onClick={onClose} aria-label="Close Bigg Boss desk">✕</button>
        )}
      </div>

      {(timeMs > 0 || left > 0) && (
        <div className="bb-timer">
          <div className="bb-timer-bar" style={{ width: `${pct}%` }} />
          <span>{fmtTime(left)}</span>
        </div>
      )}

      {flash && <div className="bb-flash">{flash}</div>}
      {announce && phase === 'announce' && !flash && <div className="bb-announce">{announce}</div>}

      {phase === 'game_open' && question && <QuestionPanel q={question} answered={answered} onAnswer={answer} onSubmitWord={submitWord} wordInput={wordInput} setWordInput={setWordInput} />}

      {phase === 'order_open' && order && (
        <div className="bb-body">
          <div className="bb-order-text">{order.text}</div>
          <div className="bb-arena-chip">📢 Stand together — I am watching the huddle from above.</div>
          <div className="bb-group-now">
            Live groups formed:
            {grouped.length === 0
              ? <span className="bb-muted"> none yet…</span>
              : grouped.map((g, i) => (
                <span key={i} className="bb-group-chip">{g.join(', ')}</span>
              ))}
          </div>
        </div>
      )}

      {phase === 'chore_open' && chore && (
        <div className="bb-body">
          <div className="bb-order-text">🧹 {chore.room?.name} — clean every grime spot!</div>
          <div className="bb-arena-chip">Spots left: <b>{spotsLeft}</b> · Press <b>E</b> near a spot · {chore.guide}</div>
        </div>
      )}

      {phase === 'cook_open' && cook && (
        <div className="bb-body">
          <div className="bb-dish">
            <span className="bb-dish-emoji">{cook.dish?.emoji}</span>
            <div>
              <b>Dish to cook: {cook.dish?.name}</b>
              <span className="bb-muted">Find the right ingredients in the kitchen!</span>
            </div>
          </div>
          <div className="bb-arena-chip">Press <b>E</b> to grab / cook · <b>R</b> to drop · Cook at the stove</div>
          {carried.length > 0 && (
            <div className="bb-carried">
              Carrying:
              {carried.map((it, i) => (
                <span key={`${it}-${i}`} className="bb-ingred">
                  {COOK_ITEMS[it]?.e} {COOK_ITEMS[it]?.name || it}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bb-board">
        <div className="bb-board-title">🪙 Coin Board</div>
        {board.length === 0 && <div className="bb-muted">No coins yet — play the tasks!</div>}
        {board.map((s) => (
          <div key={s.rank} className={`bb-rank${s.id === me.id ? ' bb-me' : ''}`}>
            <span className="bb-rank-num">{s.rank}</span>
            <span className="bb-rank-dot" style={{ background: s.color }} />
            <span className="bb-rank-name">{s.name}</span>
            <span className="bb-rank-cash">{s.coins}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function QuestionPanel({ q, answered, onAnswer, onSubmitWord, wordInput, setWordInput }) {
  const letters = typeof q.display === 'string' ? q.display.split(' ') : q.display;
  return (
    <div className="bb-body">
      <div className="bb-qcat">{q.category} · Round {q.round}</div>
      <div className="bb-q-text">{q.q}</div>

      {q.mode === 'picture' && q.emoji && <div className="bb-pic">{q.emoji}</div>}

      {q.mode === 'word' ? (
        <form onSubmit={onSubmitWord} className="bb-word">
          <div className="bb-letters">
            {Array.isArray(q.display)
              ? q.display.map((ch, i) => <span key={i} className="bb-letter">{ch}</span>)
              : letters.map((ch, i) => <span key={i} className="bb-letter">{ch === '_' ? '□' : ch}</span>)}
          </div>
          {q.hint && <div className="bb-muted">💡 {q.hint}</div>}
          <div className="bb-word-row">
            <input
              value={wordInput}
              onChange={(e) => setWordInput(e.target.value)}
              placeholder="Type the answer…"
              disabled={answered}
            />
            <button type="submit" disabled={answered || !wordInput.trim()}>Shout</button>
          </div>
        </form>
      ) : (
        <div className="bb-opts">
          {q.options.map((o, i) => (
            <button key={i} className="bb-opt" disabled={answered} onClick={() => onAnswer(i)}>
              {String.fromCharCode(65 + i)}. {o}
            </button>
          ))}
        </div>
      )}

      <div className="bb-arena-chip">📌 You must be standing in the TASK ARENA (courtyard red square) to answer!</div>
    </div>
  );
}
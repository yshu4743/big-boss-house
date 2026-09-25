import { useEffect, useRef, useState } from 'react';
import { connect } from './socket.js';

const COLORS = ['#ffb703', '#06d6a0', '#4cc9f0', '#ef476f', '#9d4edd', '#fb8500', '#80ed99', '#f9c74f'];

export default function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [color, setColor] = useState(COLORS[0]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState('');
  const socketRef = useRef(null);

  useEffect(() => () => { if (socketRef.current) socketRef.current.disconnect(); }, []);

  const submit = (e) => {
    e.preventDefault();
    setStatus('connecting');
    setError('');

    const socket = connect();
    socketRef.current = socket;

    const fail = (msg) => {
      setError(msg);
      setStatus('idle');
      socket.disconnect();
    };

    const timeout = setTimeout(() => {
      if (socketRef.current) {
        fail('Could not reach the house server. Is the server running?');
      }
    }, 8000);

    socket.on('connect', () => {
      socket.emit('login', { name, color, passcode });
    });

    socket.on('logged_in', (player) => {
      clearTimeout(timeout);
      setStatus('idle');
      socketRef.current = null; // ownership passes to the Game screen
      onLogin(socket, player);
    });

    socket.on('login_denied', ({ message }) => {
      clearTimeout(timeout);
      fail(message);
    });

    socket.on('error', ({ message }) => {
      clearTimeout(timeout);
      fail(message);
    });
  };

  return (
    <div className="login-page">
      <div className="bb-eye" aria-hidden="true">
        <span className="bb-eye-inner" />
      </div>
      <h1 className="bb-title">
        BIGG BOSS <span>HOUSE</span>
      </h1>
      <p className="bb-subtitle">
        Kerala · Season 8 — Demo House · Multiplayer Open-World Living
      </p>

      <form className="login-card" onSubmit={submit}>
        <label className="field">
          <span>Your housemate name</span>
          <input
            value={name}
            maxLength={16}
            autoFocus
            placeholder="e.g. Jaseela"
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>

        <div className="field">
          <span>Choose your avatar colour</span>
          <div className="swatches">
            {COLORS.map((c) => (
              <button
                type="button"
                key={c}
                className={c === color ? 'swatch active' : 'swatch'}
                style={{ background: c }}
                onClick={() => setColor(c)}
                aria-label={`colour ${c}`}
              />
            ))}
          </div>
        </div>

        <label className="field">
          <span>House passcode</span>
          <input
            type="text"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="House Passcode (Season 8 tagline word)"
          />
          <em className="hint">Hint: “Jayichal … ♥” — the season 8 tagline word. Ask the host if stuck.</em>
        </label>

        {error && <p className="error">{error}</p>}

        <button className="join-btn" type="submit" disabled={status === 'connecting'}>
          {status === 'connecting' ? 'Checking watchman…' : 'Enter the House'}
        </button>
      </form>

      <footer className="login-footer">
        Proximity chat · Walk close to another housemate to talk. Walk away and you won’t hear them.
      </footer>
    </div>
  );
}
import { useCallback, useRef, useState } from 'react';
import Login from './Login.jsx';
import { Game } from './Game.jsx';

export default function App() {
  const socketRef = useRef(null);
  const [screen, setScreen] = useState('login');
  const [me, setMe] = useState(null);

  const handleLogin = useCallback((socket, player) => {
    socketRef.current = socket;
    setMe(player);
    setScreen('game');
  }, []);

  const handleLeave = useCallback(() => {
    const s = socketRef.current;
    if (s) {
      s.disconnect();
      socketRef.current = null;
    }
    setScreen('login');
    setMe(null);
  }, []);

  return screen === 'login' || !me ? (
    <Login onLogin={handleLogin} />
  ) : (
    <Game socket={socketRef.current} me={me} onLeave={handleLeave} />
  );
}
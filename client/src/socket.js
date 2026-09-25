import { io } from 'socket.io-client';

export function connect() {
  const proto = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname;
  const dev = window.location.port === '5173';
  const port = dev ? ':3000' : (window.location.port ? ':' + window.location.port : '');
  const url = `${proto}://${host}${port}`;
  return io(url, { transports: ['websocket', 'polling'] });
}
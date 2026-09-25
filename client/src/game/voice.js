import { CHAT_RADIUS } from '../../../shared/config.js';

// WebRTC mesh voice: each client peers with the nearest housemates and
// streams its mic only while hold-to-talk is pressed. Listeners apply a
// distance-based gain (audible inside CHAT_RADIUS, silent beyond).
const RANGE = CHAT_RADIUS;
const PEER_CAP = 16;
const ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export class VoiceManager {
  constructor(socket, me, { onHold } = {}) {
    this.socket = socket;
    this.me = me;
    this.onHold = onHold;
    this.audioCtx = null;
    this.stream = null;
    this.local = null;
    this.peers = new Map();
    this.holding = false;
    this.ready = false;
    this.pending = null;
    this.speaking = new Set();

    socket.on('v_sig', (msg) => this._onSignal(msg));
    socket.on('v_on', ({ id }) => { if (id !== this.me.id) this.speaking.add(id); });
    socket.on('v_off', ({ id }) => { if (id !== this.me.id) this.speaking.delete(id); });
  }

  _gainAt(d) {
    if (d >= RANGE) return 0;
    const t = Math.max(0, 1 - d / RANGE);
    return t * t;
  }

  _ensure() {
    if (this.ready) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('mic unsupported');
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      this.local = this.stream.getAudioTracks()[0];
      if (this.local) this.local.enabled = false;
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();
      this.ready = true;
      this._attachLocal();
    })().catch((err) => {
      this.pending = null;
      this.ready = false;
      throw err;
    });
    return this.pending;
  }

  setHolding(on) {
    const want = !!on;
    if (this.holding === want) return;
    this.holding = want;
    if (want) {
      this._ensure().then(() => {
        if (!this.holding) return;
        if (this.local) this.local.enabled = true;
        this.socket.emit('v_on');
        if (this.onHold) this.onHold(true);
      }).catch(() => {
        this.holding = false;
        if (this.onHold) this.onHold(false);
      });
    } else {
      if (this.local) this.local.enabled = false;
      this.socket.emit('v_off');
      if (this.onHold) this.onHold(false);
    }
  }

  sync(players, mePos) {
    if (!mePos) return;
    const mx = mePos.x, my = mePos.y;
    const others = players
      .filter((p) => p.id !== this.me.id)
      .map((p) => ({ ...p, d: Math.hypot(p.x - mx, p.y - my) }));
    others.sort((a, b) => a.d - b.d);

    const wanted = new Set(others.slice(0, PEER_CAP).map((p) => p.id));
    for (const id of [...this.peers.keys()]) {
      if (!wanted.has(id)) this._closePeer(id);
    }
    for (const p of others) {
      if (wanted.has(p.id)) {
        const peer = this.peers.get(p.id);
        if (!peer) this._openPeer(p.id);
        else if (peer.gain && this.audioCtx) {
          try {
            peer.gain.gain.setTargetAtTime(this._gainAt(p.d), this.audioCtx.currentTime, 0.08);
          } catch { /* node context closed */ }
        }
      }
    }
  }

  _attachLocal() {
    if (!this.local) return;
    for (const peer of this.peers.values()) {
      if (peer.pc.getSenders().length === 0) {
        try { peer.pc.addTrack(this.local, this.stream); } catch { /* closed */ }
      }
    }
  }

  _openPeer(id) {
    let pc;
    try {
      pc = new RTCPeerConnection({ iceServers: ICE });
    } catch { return; }
    const node = this.audioCtx ? this.audioCtx.createGain() : null;
    if (node) {
      node.gain.value = 0;
      node.connect(this.audioCtx.destination);
    }
    const peer = { pc, gain: node };
    this.peers.set(id, peer);

    if (this.local) {
      try { pc.addTrack(this.local, this.stream); } catch { /* ignore */ }
    }

    pc.onnegotiationneeded = async () => {
      try {
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(await pc.createOffer());
        this.socket.emit('v_sig', { to: id, data: { sdp: pc.localDescription } });
      } catch { /* ignore */ }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate) this.socket.emit('v_sig', { to: id, data: { ice: e.candidate } });
    };

    pc.ontrack = (e) => {
      if (!node || !this.audioCtx) return;
      try {
        const src = this.audioCtx.createMediaStreamSource(new MediaStream([e.track]));
        src.connect(node);
      } catch { /* ignore */ }
    };

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState;
      if (st === 'failed' || st === 'closed') this._closePeer(id);
    };
  }

  async _onSignal({ from, data }) {
    if (from === this.me.id) return;
    try {
      await this._ensure();
    } catch {
      this._closePeer(from);
      return;
    }
    if (!this.peers.has(from)) this._openPeer(from);
    const pc = this.peers.get(from)?.pc;
    if (!pc) return;
    try {
      if (data.sdp) {
        if (data.sdp.type === 'offer') {
          await pc.setRemoteDescription(data.sdp);
          await pc.setLocalDescription(await pc.createAnswer());
          this.socket.emit('v_sig', { to: from, data: { sdp: pc.localDescription } });
        } else if (data.sdp.type === 'answer') {
          await pc.setRemoteDescription(data.sdp);
        }
      } else if (data.ice) {
        await pc.addIceCandidate(data.ice);
      }
    } catch {
      this._closePeer(from);
    }
  }

  _closePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    try { peer.pc.close(); } catch { /* ignore */ }
    if (peer.gain) { try { peer.gain.disconnect(); } catch { /* ignore */ } }
  }

  dispose() {
    for (const id of [...this.peers.keys()]) this._closePeer(id);
    this.socket.off('v_sig');
    this.socket.off('v_on');
    this.socket.off('v_off');
    if (this.local) this.local.enabled = false;
    if (this.stream) { for (const t of this.stream.getTracks()) t.stop(); }
    if (this.audioCtx) { try { this.audioCtx.close(); } catch { /* ignore */ } }
  }
}
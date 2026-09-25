import { useRef } from 'react';

const JOY_R = 58;

export function MobileControls({ engineRef }) {
  const baseRef = useRef(null);
  const thumbRef = useRef(null);
  const pointerId = useRef(null);

  const setVec = (x, y) => {
    if (thumbRef.current) thumbRef.current.style.transform = `translate(${x * JOY_R}px, ${y * JOY_R}px)`;
    engineRef.current?.setJoystick(x, y);
  };

  const handle = (e) => {
    if (e.pointerId !== pointerId.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = (e.clientX - cx) / JOY_R;
    let dy = (e.clientY - cy) / JOY_R;
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    setVec(dx, dy);
  };

  const down = (e) => {
    if (pointerId.current !== null) return;
    pointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    handle(e);
  };

  const up = (e) => {
    if (e.pointerId !== pointerId.current) return;
    pointerId.current = null;
    setVec(0, 0);
  };

  return (
    <div className="mobile-controls">
      <div
        ref={baseRef}
        className="joy"
        onPointerDown={down}
        onPointerMove={handle}
        onPointerUp={up}
        onPointerCancel={up}
        role="application"
        aria-label="Movement joystick"
      >
        <div ref={thumbRef} className="joy-thumb" />
      </div>
      <div className="act-pad">
        <button
          type="button"
          className="act-btn act"
          onPointerDown={() => engineRef.current?.act()}
          aria-label="Act"
        >
          ✋
        </button>
        <button
          type="button"
          className="act-btn drop"
          onPointerDown={() => engineRef.current?.drop()}
          aria-label="Drop carried items"
        >
          🫳
        </button>
      </div>
    </div>
  );
}
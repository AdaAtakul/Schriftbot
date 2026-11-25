// Pencil-Eingabe auf einem Canvas. Punkte kommen als [x, y, druck, ms] in x-Höhen zurück:
// x ab dem linken Rand, y ab dem oberen Rand plus `top` (z. B. −2,5, damit y = 0 die Grundlinie ist).
import { getSettings } from './storage.js';

const round = (n, d) => Math.round(n * d) / d;

export function attachPen(canvas, { unit, top = 0, onLive, onStroke, onReject }) {
  let rect, t0, pointerId = null, live = null, frame = 0;

  const toPoint = e => {
    // Maus liefert festen Druck 0,5, Finger oft 0 – dann mittleren Druck annehmen.
    const p = e.pointerType === 'pen' ? Math.max(e.pressure, 0.05) : (e.pressure || 0.5);
    const u = unit();
    return [
      round((e.clientX - rect.left) / u, 1000),
      round((e.clientY - rect.top) / u + top, 1000),
      round(p, 100),
      Math.round(e.timeStamp - t0),
    ];
  };
  const show = () => { if (!frame) frame = requestAnimationFrame(() => { frame = 0; onLive(live); }); };

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'pen' && !getSettings().allowNonPen) return onReject?.();
    if (pointerId !== null) return;
    e.preventDefault();
    pointerId = e.pointerId;
    rect = canvas.getBoundingClientRect();
    t0 = e.timeStamp;
    live = [toPoint(e)];
    try { canvas.setPointerCapture(pointerId); } catch {} // ohne Capture geht es auch, nur Rand-Fälle leiden
    show();
  });

  canvas.addEventListener('pointermove', e => {
    if (e.pointerId !== pointerId) return;
    const events = e.getCoalescedEvents?.() || [];
    for (const ev of events.length ? events : [e]) live.push(toPoint(ev));
    show();
  });

  const end = e => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    cancelAnimationFrame(frame);
    frame = 0;
    if (!live) return;
    const stroke = live;
    live = null;
    onStroke(stroke);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // Safari startet beim Pencil sonst trotz user-select Textauswahl, Lupe oder Scribble.
  // Nur Touch-Events abfangen: Pointer-Events kommen weiter an.
  for (const type of ['touchstart', 'touchmove']) canvas.addEventListener(type, e => e.preventDefault(), { passive: false });
}

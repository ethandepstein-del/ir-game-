import { useEffect, useReducer, useRef, useState } from 'react';
import { sfx } from './audio/sfx';

export function SoundControls() {
  const [, rerender] = useReducer((x: number) => x + 1, 0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const off = sfx.subscribe(rerender);
    return () => {
      off();
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  const s = sfx.settings;
  return (
    <div className="sound" ref={ref}>
      <button
        type="button"
        className="sound-btn"
        aria-label={s.muted ? 'Sound off' : 'Sound on'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" />
          {s.muted ? (
            <path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          ) : (
            <>
              <path d="M16 9.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <path d="M18.5 7a7 7 0 010 10" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity={s.volume > 0.4 ? 1 : 0.3} />
            </>
          )}
        </svg>
      </button>
      {open && (
        <div className="sound-pop" role="dialog" aria-label="Sound settings">
          <label className="sound-row" htmlFor="vol">
            <span>Volume</span>
            <input
              id="vol"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => {
                sfx.unlock();
                sfx.setVolume(Number(e.target.value));
              }}
              onPointerUp={() => sfx.click()}
            />
          </label>
          <label className="sound-row check" htmlFor="amb">
            <input id="amb" type="checkbox" checked={s.ambient} onChange={(e) => sfx.setAmbient(e.target.checked)} />
            <span>Situation-room ambience</span>
          </label>
          <label className="sound-row check" htmlFor="mute">
            <input id="mute" type="checkbox" checked={s.muted} onChange={(e) => sfx.setMuted(e.target.checked)} />
            <span>Mute all</span>
          </label>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';

const ITEMS = [
  'A pundit stands at a giant touchscreen', '"Too early to call"', 'The needle twitches', 'Someone says "bellwether"',
  'A county you\'ve never heard of matters', '"Suburban women"', 'A race is called at exactly poll close', 'Someone mentions 2018',
  '"Let\'s bring in our decision desk"', 'A map flips color and everyone gasps', 'A candidate speaks before it\'s called', '"It\'s a tale of two electorates"',
  'The graphic has a sound effect', '"Remember, we\'re only at 12% reporting"', 'A recount is mentioned', 'Someone quotes a 538-style probability',
  'A pundit says "the fundamentals"', 'You refresh the page again', '"Ballots still out in Maricopa"', 'The host says "we can now project"',
  'A candidate concedes early', 'Someone eats dinner on camera', '"Never seen anything like it"', 'A state you forgot was voting comes in',
  'A poll turns out to be right', 'A poll turns out to be wrong', '"That\'s within the margin of error"', 'Ranked-choice math appears',
  'Someone says "red mirage"', 'Someone says "blue shift"', 'A race is called, then "un-called"', 'A very tired anchor',
];

function shuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function load(): { seed: number; marks: number[] } {
  try {
    const v = localStorage.getItem('tossup.bingo');
    if (v) return JSON.parse(v);
  } catch {
    /* ignore */
  }
  return { seed: 1, marks: [] };
}

const LINES = (() => {
  const l: number[][] = [];
  for (let i = 0; i < 5; i++) {
    l.push([0, 1, 2, 3, 4].map((c) => i * 5 + c));
    l.push([0, 1, 2, 3, 4].map((r) => r * 5 + i));
  }
  l.push([0, 6, 12, 18, 24], [4, 8, 12, 16, 20]);
  return l;
})();

export function Bingo() {
  const [state, setState] = useState(load);
  const cells = useMemo(() => {
    const pick = shuffle(ITEMS, state.seed).slice(0, 24);
    pick.splice(12, 0, 'FREE: you opened this page');
    return pick;
  }, [state.seed]);
  const marked = new Set([12, ...state.marks]);
  const won = LINES.filter((l) => l.every((i) => marked.has(i)));
  useEffect(() => {
    try {
      localStorage.setItem('tossup.bingo', JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="card">
        <div className="card-head" style={{ flexWrap: 'wrap' }}>
          <div>
            <h3>Election night bingo</h3>
            <div className="sub">Tap a square when you see it on TV. Five in a row wins nothing but glory.</div>
          </div>
          <div className="row">
            <button className="btn sm" onClick={() => setState({ seed: state.seed + 1, marks: [] })}>New card</button>
            <button className="btn sm" onClick={() => setState({ ...state, marks: [] })}>Clear marks</button>
          </div>
        </div>
        <div className="bingo" role="grid" aria-label="Bingo card">
          {cells.map((c, i) => (
            <button key={i} role="gridcell" className={`bingo-cell ${marked.has(i) ? 'on' : ''} ${won.some((l) => l.includes(i)) ? 'win' : ''}`} aria-pressed={marked.has(i)} onClick={() => i !== 12 && setState((s) => ({ ...s, marks: s.marks.includes(i) ? s.marks.filter((m) => m !== i) : [...s.marks, i] }))}>
              {c}
            </button>
          ))}
        </div>
        {won.length > 0 && (
          <div className="callout" style={{ marginTop: 14, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>
            Bingo{won.length > 1 ? ` ×${won.length}` : ''}! Please continue to ignore the exit polls.
          </div>
        )}
      </div>
    </div>
  );
}

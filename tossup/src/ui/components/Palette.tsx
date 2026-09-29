import { useEffect, useMemo, useRef, useState } from 'react';
import { STATES } from '../../data/states';
import { consensus } from '../../data/ratings';
import { navigate } from '../../router';
import { ALL_RACES } from '../../state/data';
import { RatingPill } from './bits';

interface Item {
  key: string;
  label: string;
  sub: string;
  to: string;
  hay: string;
  kind: 'page' | 'state' | 'race';
  rank: number;
  rating?: ReturnType<typeof consensus>['rating'];
}

const PAGES: [string, string, string][] = [
  ['', 'Overview', 'The big picture'],
  ['generic', 'Generic ballot', 'The national polling average'],
  ['approval', 'Trump approval', 'The other big input'],
  ['senate', 'Senate forecast', '35 seats'],
  ['governors', 'Governors forecast', '36 races'],
  ['house', 'House forecast', '435 districts'],
  ['forecast', 'Forecast settings', 'Blend, shocks and scenarios'],
  ['lab', 'Flip lab', 'Force races and watch control move'],
  ['polls', 'Poll explorer', 'Every poll, with sources. Add your own'],
  ['night', 'Election night HQ', 'Run of show, bellwethers, live map'],
  ['methods', 'How it works', 'Sources, model, and what is missing'],
];

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function buildItems(): Item[] {
  const items: Item[] = [];
  for (const [to, label, sub] of PAGES) items.push({ key: `p-${to}`, label, sub, to, hay: norm(`${label} ${sub}`), kind: 'page', rank: 0 });
  for (const s of STATES) items.push({ key: `s-${s.code}`, label: s.name, sub: `State page · ${s.code}`, to: `state/${s.code.toLowerCase()}`, hay: norm(`${s.name} ${s.code}`), kind: 'state', rank: 1 });
  for (const r of ALL_RACES) {
    const names = [r.candidates.D?.name, r.candidates.R?.name, r.candidates.I?.name].filter(Boolean).join(' ');
    const office = r.office === 'senate' ? 'Senate' : r.office === 'governor' ? 'Governor' : 'House';
    items.push({
      key: `r-${r.id}`,
      label: r.title,
      sub: `${office}${names ? ` · ${names}` : ''}`,
      to: `race/${r.id}`,
      hay: norm(`${r.title} ${r.id} ${names} ${r.state}`),
      kind: 'race',
      rank: r.office === 'house' ? 3 : 2,
      rating: consensus(r).rating,
    });
  }
  return items;
}

function search(items: Item[], q: string): Item[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items.filter((i) => i.kind === 'page').slice(0, 8);
  const scored: [number, Item][] = [];
  for (const it of items) {
    let score = 0;
    let ok = true;
    for (const t of terms) {
      const at = it.hay.indexOf(t);
      if (at < 0) {
        ok = false;
        break;
      }
      score += at === 0 || it.hay[at - 1] === ' ' ? 0 : 2;
      score += at * 0.01;
    }
    if (ok) scored.push([score + it.rank * 0.5, it]);
  }
  return scored.sort((a, b) => a[0] - b[0]).slice(0, 9).map((x) => x[1]);
}

/** Press / or Ctrl/Cmd+K anywhere to jump to a race, a state or a page. */
export function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const items = useMemo(buildItems, []);
  const results = useMemo(() => search(items, q), [items, q]);

  useEffect(() => {
    if (open) {
      setQ('');
      setSel(0);
    }
  }, [open]);
  useEffect(() => setSel(0), [q]);

  if (!open) return null;
  const go = (it: Item | undefined) => {
    if (!it) return;
    onClose();
    navigate(it.to);
  };

  return (
    <div className="pal-back" onMouseDown={onClose} role="presentation">
      <div
        className="pal"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
          else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSel((s) => Math.min(s + 1, results.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSel((s) => Math.max(s - 1, 0));
          } else if (e.key === 'Enter') go(results[sel]);
        }}
      >
        <input
          ref={inputRef}
          autoFocus
          className="pal-input"
          placeholder="Search a race, a candidate, a state or a page"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search"
          autoComplete="off"
          spellCheck={false}
        />
        <ul className="pal-list" role="listbox">
          {results.length === 0 && <li className="pal-empty">Nothing matches. Try a state name or a candidate.</li>}
          {results.map((it, i) => (
            <li key={it.key} role="option" aria-selected={i === sel} className={i === sel ? 'on' : ''} onMouseEnter={() => setSel(i)} onClick={() => go(it)}>
              <div className="pal-main">
                <b>{it.label}</b>
                <span>{it.sub}</span>
              </div>
              {it.rating ? <RatingPill rating={it.rating} /> : <span className="chip">{it.kind === 'page' ? 'Page' : 'State'}</span>}
            </li>
          ))}
        </ul>
        <div className="pal-foot">
          <span><kbd>↑</kbd> <kbd>↓</kbd> to move</span>
          <span><kbd>Enter</kbd> to go</span>
          <span><kbd>Esc</kbd> to close</span>
        </div>
      </div>
    </div>
  );
}

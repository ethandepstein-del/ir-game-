import { useEffect, useState, type ReactNode } from 'react';
import { Link, useRoute } from '../router';
import { useIsDark, usePrefs } from '../state/prefs';
import { Coin } from './components/Coin';
import { Palette } from './components/Palette';
import { useToast } from './components/bits';
import { daysUntil } from './format';
import { ELECTION_DAY, AS_OF } from '../engine/model';
import { ALL_POLL_COUNT } from '../state/data';

const NAV: { to: string; label: string; key: string; cls?: string }[] = [
  { to: '', label: 'Overview', key: '' },
  { to: 'generic', label: 'Generic ballot', key: 'generic' },
  { to: 'approval', label: 'Approval', key: 'approval' },
  { to: 'senate', label: 'Senate', key: 'senate' },
  { to: 'governors', label: 'Governors', key: 'governors' },
  { to: 'house', label: 'House', key: 'house' },
  { to: 'forecast', label: 'Forecast', key: 'forecast' },
  { to: 'lab', label: 'Flip lab', key: 'lab' },
  { to: 'polls', label: 'Polls', key: 'polls' },
  { to: 'night', label: 'Election night', key: 'night', cls: 'night' },
];

const FLIPS = [
  'Heads. This has no effect on the forecast.',
  'Tails. This has no effect on the forecast either.',
  'It landed on its edge. Pundits are calling it a toss-up.',
  'Heads. A new poll just came in, and it did not care.',
  'Tails. Try again, or go read the polls.',
];

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const key = route[0] === 'race' || route[0] === 'state' ? (route[1]?.split('-')[0] ?? '') : (route[0] ?? '');
  const active = route[0] === 'race' ? (route[1]?.startsWith('senate') ? 'senate' : route[1]?.startsWith('gov') ? 'governors' : 'house') : route[0] === 'state' ? '' : key;
  const { setTheme, nerd, setNerd } = usePrefs();
  const [spin, setSpin] = useState(0);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setSearching((v) => !v);
      } else if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setSearching(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const toast = useToast();
  const d = daysUntil(ELECTION_DAY, AS_OF);
  const dark = useIsDark();

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <button
            className="brand"
            aria-label="Tossup. Click to flip a coin."
            onClick={() => {
              setSpin((s) => s + 1);
              toast.say(FLIPS[Math.floor(Math.random() * FLIPS.length)]);
            }}
          >
            <Coin key={spin} spin={spin > 0} />
            <span>Tossup</span>
          </button>
          <nav className="nav" aria-label="Main">
            {NAV.map((n) => (
              <Link key={n.key} to={n.to} className={n.cls} aria-current={active === n.key ? 'page' : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="top-actions">
            <span className="countdown" title="Election Day is Tuesday, November 3, 2026">
              {d} days to go
            </span>
            <button className="icon-btn" aria-label="Search races, states and pages (press /)" title="Search (press /)" onClick={() => setSearching(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.2" /><path d="m15.2 15.2 5 5" /></svg>
            </button>
            <label className="switch" title="Show the wonky details everywhere">
              <input type="checkbox" checked={nerd} onChange={(e) => setNerd(e.target.checked)} />
              Nerd mode
            </label>
            <button className="icon-btn" aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'} onClick={() => setTheme(dark ? 'light' : 'dark')}>
              {dark ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" /></svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.2A8.6 8.6 0 0 1 9.8 3.5a8.6 8.6 0 1 0 10.7 10.7Z" /></svg>
              )}
            </button>
          </div>
        </div>
      </header>
      <Palette open={searching} onClose={() => setSearching(false)} />
      <main className="page">{children}</main>
      <footer className="footer">
        <div className="footer-inner">
          <div>
            <b style={{ color: 'var(--ink-2)' }}>Tossup</b> is a polling aggregator and forecast for the November 3, 2026 US midterms. Data is current as of September 29, 2026 and covers {ALL_POLL_COUNT} polls, each linked to its source. Verify anything you plan to act on at the source.
          </div>
          <div>
            Polls and ratings were collected from public reporting; the forecast, averages and maps are computed here. Not affiliated with any pollster, forecaster or news outlet. Tip: press / to search. <Link to="methods">How it works, what's estimated, and what's missing</Link>.
          </div>
        </div>
      </footer>
      {toast.node}
    </>
  );
}

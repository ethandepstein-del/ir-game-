import { useState } from 'react';
import { Bellwethers } from '../night/Bellwethers';
import { Bingo } from '../night/Bingo';
import { LiveMap } from '../night/LiveMap';
import { RunOfShow } from '../night/RunOfShow';
import { WatchList } from '../night/WatchList';

type Tab = 'show' | 'watch' | 'live' | 'bell' | 'bingo';

export function Night() {
  const [tab, setTab] = useState<Tab>('show');
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="page-head">
        <div>
          <div className="eyebrow">Tuesday, November 3, 2026</div>
          <h1>Election night HQ</h1>
          <p className="lede">Everything for the evening: when polls close, what to follow each hour, the races that decide control, and a live map with a win-probability needle. Rehearse on the practice night.</p>
        </div>
      </div>
      <div className="seg night-tabs" role="tablist" aria-label="Election night sections">
        {([['show', 'Run of show'], ['watch', 'What to watch'], ['live', 'Live map'], ['bell', 'Bellwethers'], ['bingo', 'Bingo']] as [Tab, string][]).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>
      {tab === 'show' && <RunOfShow onPractice={() => setTab('live')} />}
      {tab === 'watch' && <WatchList />}
      {tab === 'live' && <LiveMap />}
      {tab === 'bell' && <Bellwethers />}
      {tab === 'bingo' && <Bingo />}
    </div>
  );
}

import { lazy, Suspense } from 'react';
import { PrefsProvider } from './state/prefs';
import { ForecastProvider } from './state/forecast';
import { useRoute } from './router';
import { Shell } from './ui/Shell';
import { Home } from './ui/pages/Home';

const Generic = lazy(() => import('./ui/pages/Generic').then((m) => ({ default: m.Generic })));
const Approval = lazy(() => import('./ui/pages/Approval').then((m) => ({ default: m.Approval })));
const Chamber = lazy(() => import('./ui/pages/Chamber').then((m) => ({ default: m.Chamber })));
const RacePage = lazy(() => import('./ui/pages/RacePage').then((m) => ({ default: m.RacePage })));
const StatePage = lazy(() => import('./ui/pages/StatePage').then((m) => ({ default: m.StatePage })));
const Forecast = lazy(() => import('./ui/pages/Forecast').then((m) => ({ default: m.Forecast })));
const Lab = lazy(() => import('./ui/pages/Lab').then((m) => ({ default: m.Lab })));
const Polls = lazy(() => import('./ui/pages/Polls').then((m) => ({ default: m.Polls })));
const Night = lazy(() => import('./ui/pages/Night').then((m) => ({ default: m.Night })));
const Methods = lazy(() => import('./ui/pages/Methods').then((m) => ({ default: m.Methods })));

function Routes() {
  const [a, b] = useRoute();
  switch (a) {
    case undefined:
    case '':
      return <Home />;
    case 'generic':
      return <Generic />;
    case 'approval':
      return <Approval />;
    case 'senate':
      return <Chamber office="senate" />;
    case 'governors':
      return <Chamber office="governor" />;
    case 'house':
      return <Chamber office="house" />;
    case 'race':
      return <RacePage id={b ?? ''} />;
    case 'state':
      return <StatePage code={(b ?? '').toUpperCase()} />;
    case 'forecast':
      return <Forecast />;
    case 'lab':
      return <Lab />;
    case 'polls':
      return <Polls />;
    case 'night':
      return <Night />;
    case 'methods':
      return <Methods />;
    default:
      return <Home />;
  }
}

export function App() {
  return (
    <PrefsProvider>
      <ForecastProvider>
        <Shell>
          <Suspense fallback={<div className="skeleton" style={{ height: 320 }} />}>
            <Routes />
          </Suspense>
        </Shell>
      </ForecastProvider>
    </PrefsProvider>
  );
}

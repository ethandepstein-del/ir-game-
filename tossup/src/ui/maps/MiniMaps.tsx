import { useForecast } from '../../state/forecast';
import { GOVERNOR_RACES, SENATE_RACES } from '../../data/races';
import { consensus } from '../../data/ratings';
import { HOUSE_INDEX } from '../../data/house';
import { RATING_VAR, probFill } from '../format';
import { navigate } from '../../router';
import { HexMap, StateMap } from './maps';

export function StateMapMini({ office }: { office: 'senate' | 'governor' }) {
  const { result } = useForecast();
  const races = office === 'senate' ? SENATE_RACES : GOVERNOR_RACES;
  const byState = Object.fromEntries(races.map((r) => [r.state, r]));
  const pD = (id: string) => result?.races.find((x) => x.id === id)?.pD;
  return (
    <StateMap
      label={`${office} map colored by Democratic win probability`}
      labels={false}
      fill={(st) => {
        const r = byState[st];
        if (!r) return undefined;
        const p = pD(r.id);
        return p === undefined ? RATING_VAR[consensus(r).rating] : probFill(p);
      }}
      onSelect={(st) => byState[st] && navigate(`race/${byState[st].id}`)}
    />
  );
}

export function HouseMapMini() {
  const { result } = useForecast();
  const pd = result ? Object.fromEntries(result.races.filter((r) => r.id.startsWith('house-')).map((r) => [r.id, r.pD])) : {};
  return (
    <HexMap
      mini
      labels={false}
      label="House cartogram colored by Democratic win probability"
      fill={(id) => (pd[id] !== undefined ? probFill(pd[id]) : RATING_VAR[consensus(HOUSE_INDEX[id]).rating])}
      onSelect={(id) => navigate(`race/${id}`)}
    />
  );
}

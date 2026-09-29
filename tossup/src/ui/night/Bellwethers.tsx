import { useMemo } from 'react';
import { Link } from '../../router';
import { STATE_BY_CODE } from '../../data/states';
import { fmtClose } from '../pages/RacePage';
import { prob } from '../format';
import { useWatchRows } from './common';

// Places analysts commonly watch, by state. These are descriptions of where votes come from and
// what each area tends to signal, not predictions. Names of counties are standard reference points.
const PLACES: { st: string; where: string; why: string }[] = [
  { st: 'VA', where: 'Loudoun, Prince William, Virginia Beach', why: 'Northern Virginia suburbs and the Hampton Roads coast report early and speak to VA-01, VA-02 and VA-05.' },
  { st: 'GA', where: 'Cobb, Gwinnett, Forsyth', why: 'The Atlanta suburbs. Democrats run up margins in Cobb and Gwinnett; Forsyth is the Republican suburb to compare with 2024.' },
  { st: 'NC', where: 'Wake, Mecklenburg, New Hanover', why: 'Early vote posts within minutes of close. Compare the statewide margin with the Senate polling lead.' },
  { st: 'OH', where: 'Delaware, Hamilton, Lucas', why: 'Suburban Columbus and Cincinnati versus the Toledo area. Watch OH-01, OH-09 and OH-13 as well as the Senate race.' },
  { st: 'FL', where: 'Miami-Dade, Hillsborough, Pinellas, Seminole', why: 'Miami-Dade shows how Hispanic voters are breaking; the Tampa Bay counties are the swingy middle. Florida counts fast.' },
  { st: 'PA', where: 'Bucks, Chester, Delaware, Montgomery, Northampton, Erie', why: 'The Philadelphia suburbs decide PA-01, PA-07, PA-08 and PA-10. Northampton and Erie are classic swing counties.' },
  { st: 'MI', where: 'Oakland, Macomb, Kent, Ottawa', why: 'Oakland and Kent are the suburban swing; Macomb the working-class swing. Detroit and big counties can report late.' },
  { st: 'WI', where: 'Waukesha, Dane, Milwaukee, Brown', why: 'The Milwaukee suburbs (Waukesha and neighbors) against Dane turnout. Milwaukee\'s central count arrives late.' },
  { st: 'AZ', where: 'Maricopa, Pima', why: 'Maricopa is about 60% of the state and counts slowly. Early ballots dominate the first drop.' },
  { st: 'NV', where: 'Clark, Washoe', why: 'Clark (Las Vegas) is most of the vote. Mail ballots arriving after Election Day can leave close races open for days.' },
  { st: 'TX', where: 'Harris, Dallas, Bexar, Hidalgo, Williamson, Collin', why: 'The Rio Grande Valley (Hidalgo, Cameron) shows Hispanic voters\' direction; Williamson and Collin are the suburban swing.' },
  { st: 'NY', where: 'Nassau, Suffolk, Orange, Dutchess, Westchester', why: 'Long Island and the Hudson Valley decide NY-01, NY-04, NY-17 and NY-19. Upstate counts first; the city and mail ballots later.' },
  { st: 'IA', where: 'Polk, Linn, Johnson, Scott, Story', why: 'Des Moines and Cedar Rapids suburbs against rural margins. Iowa counts fast, so it is called early on a decisive night.' },
  { st: 'MN', where: 'Hennepin, Ramsey, Dakota, Washington, St. Louis', why: 'The Twin Cities suburbs and the Iron Range decide the Senate race and the governor\'s race.' },
  { st: 'CO', where: 'Jefferson, Arapahoe, Adams, El Paso', why: 'The Denver suburbs decide CO-05 and CO-08. Colorado votes by mail and counts fairly fast.' },
  { st: 'CA', where: 'Orange, San Diego, Central Valley, Inland Empire', why: 'Prop 50 redrew five seats. Early results lean Republican and later ballots lean Democratic, so don\'t call anything off the first drop.' },
  { st: 'NE', where: 'Douglas (Omaha), Sarpy', why: 'NE-02 is the Omaha district; Douglas County also matters for the Osborn Senate race.' },
  { st: 'ME', where: 'Cumberland, Androscoggin, Penobscot', why: 'ME-02 is the big rural Second District. Maine uses ranked-choice voting, which can add days in a close race.' },
];

export function Bellwethers() {
  const rows = useWatchRows();
  const early = useMemo(
    () => rows.filter((r) => r.close <= 21 && r.pD > 0.05 && r.pD < 0.95).sort((a, b) => a.close - b.close || b.swing - a.swing).slice(0, 14),
    [rows],
  );
  return (
    <div className="stack" style={{ gap: 22 }}>
      <div className="callout info">
        <b>What a bellwether is here.</b> A bellwether is a race or place that tells you something before the whole picture is in. We rank races two ways: statistically, by how well each reads the national mood, and by the places analysts habitually watch. Neither is a prediction.
      </div>
      <div className="card">
        <div className="card-head"><div><h3>First reads of the night</h3><div className="sub">Competitive races that close by 9 pm Eastern, in the order they close</div></div></div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Closes</th><th>Race</th><th className="r">Dem. win</th><th>What it tells you</th></tr></thead>
            <tbody>
              {early.map((r) => (
                <tr key={r.meta.id}>
                  <td className="num">{fmtClose(r.close)}</td>
                  <td><Link to={`race/${r.meta.id}`}>{r.meta.title}</Link></td>
                  <td className="r num">{prob(r.pD)}</td>
                  <td className="muted" style={{ fontSize: 13.5 }}>
                    {r.meta.office === 'senate' ? 'A statewide read on the Senate map and a proxy for the national mood.' : r.meta.office === 'governor' ? 'A statewide read that often tracks the Senate race in the same state.' : 'An early House data point in a suburban or swing district; if the party out of power overperforms here, expect the same in similar seats later.'}
                    {' '}Counts {r.pace === 'fast' ? 'fast' : r.pace === 'slow' ? 'slowly' : 'at a moderate pace'}.
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-head"><div><h3>Places to watch</h3><div className="sub">Counties and regions that analysts commonly use to gauge a state, by poll-close time</div></div></div>
        <div className="grid g2" style={{ gap: 14 }}>
          {PLACES.sort((a, b) => STATE_BY_CODE[a.st].close - STATE_BY_CODE[b.st].close).map((p) => (
            <div key={p.st} className="place">
              <div className="row" style={{ gap: 8 }}>
                <Link to={`state/${p.st.toLowerCase()}`} className="chip">{STATE_BY_CODE[p.st].name}</Link>
                <span className="faint" style={{ fontSize: 12.5 }}>closes {fmtClose(STATE_BY_CODE[p.st].close)} ET</span>
              </div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>{p.where}</div>
              <div className="muted" style={{ fontSize: 13.5, marginTop: 2 }}>{p.why}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

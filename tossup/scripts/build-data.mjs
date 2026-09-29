// Normalizes research files in data/polls/*.jsonl into src/data/generated/polls.json.
// Each line is one poll with a source URL. Run: npm run data
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';

const dir = 'data/polls';
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const num = (v) => (v === null || v === undefined ? null : Number(v));

const generic = [];
const approval = [];
const races = {};
const problems = [];

function readLines(file) {
  return readFileSync(`${dir}/${file}`, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      try {
        return JSON.parse(l);
      } catch (e) {
        problems.push(`${file}:${i + 1} invalid JSON`);
        return null;
      }
    })
    .filter(Boolean);
}

function isoOk(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

for (const file of readdirSync(dir).filter((f) => f.endsWith('.jsonl')).sort()) {
  for (const raw of readLines(file)) {
    if (!isoOk(raw.start) || !isoOk(raw.end) || !raw.source) {
      problems.push(`${file}: bad dates or missing source for ${raw.pollster}`);
      continue;
    }
    const approx = Boolean(raw.approx) || /approximate/i.test(raw.note ?? '');
    if (file.startsWith('approval')) {
      approval.push({
        id: `appr-${slug(raw.pollster)}-${raw.end}`,
        pollster: raw.pollster,
        start: raw.start,
        end: raw.end,
        n: raw.n,
        pop: raw.pop,
        approve: num(raw.approve),
        disapprove: num(raw.disapprove),
        approx: approx || undefined,
        note: raw.note,
        source: raw.source,
      });
      continue;
    }
    const race = file.startsWith('generic') ? 'generic' : raw.race;
    if (!race) {
      problems.push(`${file}: missing race for ${raw.pollster}`);
      continue;
    }
    const d = num(raw.d);
    const r = num(raw.r);
    const margin = raw.margin !== undefined ? Number(raw.margin) : d !== null && r !== null ? +(d - r).toFixed(2) : null;
    if (margin === null) {
      problems.push(`${file}: no margin for ${raw.pollster}`);
      continue;
    }
    const poll = {
      id: `${race}-${slug(raw.pollster)}-${raw.end}`,
      race,
      pollster: raw.pollster,
      start: raw.start,
      end: raw.end,
      n: raw.n,
      pop: raw.pop ?? 'lv',
      d,
      r,
      o: raw.o ?? undefined,
      margin,
      approx: approx || undefined,
      internal: raw.internal,
      indep: raw.indep,
      twoParty: raw.twoParty || /two-party/i.test(raw.note ?? '') || undefined,
      note: raw.note,
      source: raw.source,
    };
    if (race === 'generic') generic.push(poll);
    else (races[race] ??= []).push(poll);
  }
}

// De-duplicate ids (same pollster, same end date) by appending an index.
function dedupe(list) {
  const seen = new Map();
  for (const p of list) {
    const k = p.id;
    const c = (seen.get(k) ?? 0) + 1;
    seen.set(k, c);
    if (c > 1) p.id = `${k}-${c}`;
  }
}
const byEnd = (a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : 0);
generic.sort(byEnd);
approval.sort(byEnd);
dedupe(generic);
dedupe(approval);
for (const k of Object.keys(races)) {
  races[k].sort(byEnd);
  dedupe(races[k]);
}

mkdirSync('src/data/generated', { recursive: true });
const out = { generic, approval, races, builtAt: new Date().toISOString().slice(0, 10) };
writeFileSync('src/data/generated/polls.json', JSON.stringify(out));
const raceCount = Object.values(races).reduce((a, l) => a + l.length, 0);
console.log(`generic ${generic.length}, approval ${approval.length}, race polls ${raceCount} across ${Object.keys(races).length} races`);
if (problems.length) {
  console.warn('PROBLEMS:\n' + problems.join('\n'));
  process.exitCode = 1;
}

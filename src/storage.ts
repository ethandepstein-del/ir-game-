import type { ConceptId } from './data/concepts';

export interface Progress {
  concepts: ConceptId[];
  wins: Record<string, number>;
  played: number;
}

const KEY = 'anarchy/progress/v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { concepts: p.concepts ?? [], wins: p.wins ?? {}, played: p.played ?? 0 };
    }
  } catch {
    // Storage may be unavailable; progress is a convenience.
  }
  return { concepts: [], wins: {}, played: 0 };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Ignore.
  }
}

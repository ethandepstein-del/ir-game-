import type { ConceptId } from './data/concepts';

export interface Progress {
  concepts: ConceptId[];
  best: Record<string, { score: number; grade: string }>;
}

const KEY = 'the-table/progress/v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Progress>;
      return { concepts: p.concepts ?? [], best: p.best ?? {} };
    }
  } catch {
    // Storage can be unavailable (private mode, sandboxed frames); progress is a convenience.
  }
  return { concepts: [], best: {} };
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Ignore: the game plays fine without persistence.
  }
}

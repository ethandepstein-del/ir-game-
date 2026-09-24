import { useCallback, useEffect, useState } from 'react';
import type { ConceptId } from './data/concepts';
import type { PowerId } from './data/world';
import { newGame } from './engine/game';
import type { GameState } from './engine/types';
import { loadProgress, saveProgress, type Progress } from './storage';
import { sfx } from './ui/audio/sfx';
import { Codex } from './ui/Codex';
import { End } from './ui/End';
import { Game } from './ui/Game';
import { Start } from './ui/Start';

/** Interface sounds for every button, wired once at the document level. */
function useUiSounds() {
  useEffect(() => {
    const unlock = () => sfx.unlock();
    const click = (e: MouseEvent) => {
      const el = (e.target as Element).closest('button, [role="button"], input[type="checkbox"]');
      if (el && !(el as HTMLButtonElement).disabled && !el.closest('.map')) sfx.click();
    };
    let lastHover: Element | null = null;
    const over = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const el = (e.target as Element).closest('button:not(:disabled), .terr');
      if (el && el !== lastHover) sfx.hover();
      lastHover = el;
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('click', click);
    document.addEventListener('pointerover', over);
    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('click', click);
      document.removeEventListener('pointerover', over);
    };
  }, []);
}

export function App() {
  const [screen, setScreen] = useState<'start' | 'game' | 'end'>('start');
  const [game, setGame] = useState<GameState | null>(null);
  const [codex, setCodex] = useState<{ focus?: ConceptId } | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);
  useUiSounds();

  const update = useCallback((fn: (p: Progress) => Progress) => {
    setProgress((prev) => {
      const next = fn(prev);
      saveProgress(next);
      return next;
    });
  }, []);

  const learn = useCallback(
    (ids: ConceptId[]) => update((p) => ({ ...p, concepts: [...new Set([...p.concepts, ...ids])] })),
    [update],
  );

  const start = (p: PowerId) => {
    setGame(newGame(p));
    setScreen('game');
    window.scrollTo(0, 0);
  };

  const end = () => {
    if (!game) return;
    update((p) => ({
      ...p,
      played: p.played + 1,
      wins: game.winner === game.player ? { ...p.wins, [game.player]: (p.wins[game.player] ?? 0) + 1 } : p.wins,
    }));
    learn(['offensive-realism', 'defensive-realism', 'revisionism', 'institutions']);
    setScreen('end');
    window.scrollTo(0, 0);
  };

  return (
    <>
      {screen === 'start' && <Start progress={progress} onStart={start} onCodex={() => setCodex({})} />}
      {screen === 'game' && game && (
        <Game game={game} setGame={setGame} onLearn={learn} onCodex={(id) => setCodex({ focus: id })} onQuit={() => setScreen('start')} onEnd={end} />
      )}
      {screen === 'end' && game && (
        <End game={game} onAgain={() => start(game.player)} onMenu={() => setScreen('start')} onCodex={(id) => setCodex({ focus: id })} />
      )}
      {codex && <Codex unlocked={progress.concepts} focus={codex.focus} onBack={() => setCodex(null)} />}
    </>
  );
}

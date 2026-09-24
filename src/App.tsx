import { useCallback, useState } from 'react';
import type { ConceptId } from './data/concepts';
import type { PowerId } from './data/world';
import { newGame } from './engine/game';
import type { GameState } from './engine/types';
import { loadProgress, saveProgress, type Progress } from './storage';
import { Codex } from './ui/Codex';
import { End } from './ui/End';
import { Game } from './ui/Game';
import { Start } from './ui/Start';

export function App() {
  const [screen, setScreen] = useState<'start' | 'game' | 'end'>('start');
  const [game, setGame] = useState<GameState | null>(null);
  const [codex, setCodex] = useState<{ focus?: ConceptId } | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);

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
  };

  const end = () => {
    if (!game) return;
    update((p) => ({
      ...p,
      played: p.played + 1,
      wins: game.winner === game.player ? { ...p.wins, [game.player]: (p.wins[game.player] ?? 0) + 1 } : p.wins,
    }));
    setScreen('end');
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

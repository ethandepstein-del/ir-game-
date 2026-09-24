import { useCallback, useState } from 'react';
import type { ConceptId } from './data/concepts';
import { debriefConcepts, newGame, result } from './engine/game';
import type { GameState } from './engine/types';
import { loadProgress, saveProgress, type Progress } from './storage';
import { Briefing } from './ui/Briefing';
import { Codex } from './ui/Codex';
import { Debrief } from './ui/Debrief';
import { Table } from './ui/Table';
import { Title } from './ui/Title';

type Screen =
  | { name: 'title' }
  | { name: 'briefing'; scenarioId: string }
  | { name: 'table' }
  | { name: 'debrief' }
  | { name: 'codex'; focus?: ConceptId; back: 'title' | 'debrief' };

export function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'title' });
  const [game, setGame] = useState<GameState | null>(null);
  const [progress, setProgress] = useState<Progress>(loadProgress);

  const start = useCallback((scenarioId: string) => {
    setGame(newGame(scenarioId));
    setScreen({ name: 'table' });
    window.scrollTo(0, 0);
  }, []);

  const finish = useCallback(
    (final: GameState) => {
      const r = result(final);
      const prevBest = progress.best[final.scenarioId];
      const next: Progress = {
        concepts: [...new Set([...progress.concepts, ...debriefConcepts(final)])],
        best: !prevBest || r.score > prevBest.score ? { ...progress.best, [final.scenarioId]: { score: r.score, grade: r.grade } } : progress.best,
      };
      setProgress(next);
      saveProgress(next);
      setScreen({ name: 'debrief' });
      window.scrollTo(0, 0);
    },
    [progress],
  );

  const openCodex = (focus: ConceptId | undefined, back: 'title' | 'debrief') => {
    setScreen({ name: 'codex', focus, back });
    window.scrollTo(0, 0);
  };

  switch (screen.name) {
    case 'title':
      return (
        <Title
          progress={progress}
          onPick={(id) => setScreen({ name: 'briefing', scenarioId: id })}
          onCodex={() => openCodex(undefined, 'title')}
        />
      );
    case 'briefing':
      return <Briefing scenarioId={screen.scenarioId} onStart={() => start(screen.scenarioId)} onBack={() => setScreen({ name: 'title' })} />;
    case 'table':
      return game ? <Table game={game} setGame={setGame} onFinish={finish} onQuit={() => setScreen({ name: 'title' })} /> : null;
    case 'debrief':
      return game ? (
        <Debrief
          game={game}
          onReplay={() => start(game.scenarioId)}
          onMenu={() => setScreen({ name: 'title' })}
          onConcept={(id) => openCodex(id, 'debrief')}
        />
      ) : null;
    case 'codex':
      return <Codex unlocked={progress.concepts} focus={screen.focus} onBack={() => setScreen(screen.back === 'title' ? { name: 'title' } : { name: 'debrief' })} />;
  }
}

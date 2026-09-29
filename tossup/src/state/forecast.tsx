import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import SimWorker from '../engine/sim.worker?worker&inline';
import { DEFAULT_CONFIG, buildRaceModels, getEnvironment, mergeRacePolls, type Environment, type ModelConfig, type RaceModel } from '../engine/model';
import { simulate, type Constraints, type SimResult } from '../engine/sim';
import type { WorkerRequest, WorkerResponse } from '../engine/sim.worker';
import type { ApprovalPoll, Poll } from '../data/types';
import { aggregateApproval, aggregateGeneric } from '../engine/aggregate';
import { AS_OF } from '../engine/model';
import polls from '../data/generated/polls.json';

interface Pending {
  resolve: (r: SimResult) => void;
  reject: (e: Error) => void;
}

/** One shared worker with promise-based requests; falls back to the main thread if workers are unavailable. */
class SimClient {
  private worker: Worker | null = null;
  private seq = 0;
  private pending = new Map<number, Pending>();

  constructor() {
    try {
      this.worker = new SimWorker();
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        const p = this.pending.get(e.data.id);
        if (!p) return;
        this.pending.delete(e.data.id);
        if (e.data.result) p.resolve(e.data.result);
        else p.reject(new Error(e.data.error ?? 'simulation failed'));
      };
      this.worker.onerror = () => {
        this.worker = null;
      };
    } catch {
      this.worker = null;
    }
  }

  run(config: ModelConfig, constraints?: Constraints): Promise<SimResult> {
    const id = ++this.seq;
    if (!this.worker) {
      return new Promise((resolve, reject) =>
        setTimeout(() => {
          try {
            const models = buildRaceModels(config);
            resolve(simulate(models, config, config.envOverride ?? getEnvironment(config.extraPolls, config.extraApproval).blend, constraints));
          } catch (e) {
            reject(e as Error);
          }
        }, 0),
      );
    }
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker!.postMessage({ id, config, constraints } satisfies WorkerRequest);
    });
  }
}

let client: SimClient | null = null;
export const simClient = () => (client ??= new SimClient());

interface ForecastCtx {
  config: ModelConfig;
  setConfig: (patch: Partial<ModelConfig>) => void;
  resetConfig: () => void;
  env: Environment;
  models: RaceModel[];
  modelById: Record<string, RaceModel>;
  result: SimResult | null;
  running: boolean;
  /** Run an ad-hoc simulation (scenarios, election night). */
  run: (constraints?: Constraints, over?: Partial<ModelConfig>) => Promise<SimResult>;
  addUserPoll: (p: Poll) => void;
  addUserApproval: (p: ApprovalPoll) => void;
  removeUserPoll: (id: string) => void;
  clearUserPolls: () => void;
}

const Ctx = createContext<ForecastCtx | null>(null);

function loadUser<T>(key: string): T[] {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T[]) : [];
  } catch {
    return [];
  }
}
function saveUser(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* ignore */
  }
}

export function ForecastProvider({ children }: { children: ReactNode }) {
  const [config, setCfg] = useState<ModelConfig>(() => ({
    ...DEFAULT_CONFIG,
    extraPolls: loadUser<Poll>('tossup.userPolls'),
    extraApproval: loadUser<ApprovalPoll>('tossup.userApproval'),
  }));
  const [result, setResult] = useState<SimResult | null>(null);
  const [running, setRunning] = useState(true);
  const env = useMemo(() => getEnvironment(config.extraPolls, config.extraApproval), [config.extraPolls, config.extraApproval]);
  const models = useMemo(() => buildRaceModels(config), [config]);
  const modelById = useMemo(() => Object.fromEntries(models.map((m) => [m.id, m])), [models]);
  const token = useRef(0);

  useEffect(() => {
    const my = ++token.current;
    setRunning(true);
    const t = setTimeout(() => {
      simClient()
        .run(config)
        .then((r) => {
          if (my === token.current) {
            setResult(r);
            setRunning(false);
          }
        })
        .catch(() => my === token.current && setRunning(false));
    }, 120);
    return () => clearTimeout(t);
  }, [config]);

  const setConfig = useCallback((patch: Partial<ModelConfig>) => setCfg((c) => ({ ...c, ...patch })), []);
  const resetConfig = useCallback(() => setCfg((c) => ({ ...DEFAULT_CONFIG, extraPolls: c.extraPolls, extraApproval: c.extraApproval })), []);
  const addUserPoll = useCallback((p: Poll) => setCfg((c) => { const next = [...c.extraPolls, p]; saveUser('tossup.userPolls', next); return { ...c, extraPolls: next }; }), []);
  const addUserApproval = useCallback((p: ApprovalPoll) => setCfg((c) => { const next = [...c.extraApproval, p]; saveUser('tossup.userApproval', next); return { ...c, extraApproval: next }; }), []);
  const removeUserPoll = useCallback((id: string) => setCfg((c) => {
    const a = c.extraPolls.filter((p) => p.id !== id);
    const b = c.extraApproval.filter((p) => p.id !== id);
    saveUser('tossup.userPolls', a);
    saveUser('tossup.userApproval', b);
    return { ...c, extraPolls: a, extraApproval: b };
  }), []);
  const clearUserPolls = useCallback(() => setCfg((c) => { saveUser('tossup.userPolls', []); saveUser('tossup.userApproval', []); return { ...c, extraPolls: [], extraApproval: [] }; }), []);
  const run = useCallback(
    (constraints?: Constraints, over?: Partial<ModelConfig>) => simClient().run({ ...config, ...over }, constraints),
    [config],
  );

  const value = useMemo(
    () => ({ config, setConfig, resetConfig, env, models, modelById, result, running, run, addUserPoll, addUserApproval, removeUserPoll, clearUserPolls }),
    [config, setConfig, resetConfig, env, models, modelById, result, running, run, addUserPoll, addUserApproval, removeUserPoll, clearUserPolls],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useForecast(): ForecastCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useForecast outside provider');
  return v;
}

/** Aggregates that include any polls the user added. */
export function useAgg() {
  const { config } = useForecast();
  return useMemo(() => {
    const genericPolls = [...(polls.generic as Poll[]), ...config.extraPolls.filter((p) => p.race === 'generic')];
    const approvalPolls = [...(polls.approval as ApprovalPoll[]), ...config.extraApproval];
    return {
      genericPolls,
      approvalPolls,
      generic: aggregateGeneric(genericPolls, AS_OF),
      approval: aggregateApproval(approvalPolls, AS_OF),
      mergedRace: mergeRacePolls(config.extraPolls),
    };
  }, [config.extraPolls, config.extraApproval]);
}

/// <reference lib="webworker" />
import { buildRaceModels, getEnvironment, type ModelConfig } from './model';
import { simulate, type Constraints, type SimResult } from './sim';

export interface WorkerRequest {
  id: number;
  config: ModelConfig;
  constraints?: Constraints;
}
export interface WorkerResponse {
  id: number;
  result?: SimResult;
  error?: string;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, config, constraints } = e.data;
  try {
    const models = buildRaceModels(config);
    const M = config.envOverride ?? getEnvironment(config.extraPolls, config.extraApproval).blend;
    const result = simulate(models, config, M, constraints);
    (self as unknown as Worker).postMessage({ id, result } satisfies WorkerResponse);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) } satisfies WorkerResponse);
  }
};

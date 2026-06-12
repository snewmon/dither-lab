import * as Comlink from 'comlink';
import type { RenderRequest, RenderResult, StackEntry } from './types';

type WorkerApi = { runStack(req: RenderRequest): Promise<RenderResult> };

let worker: Worker | null = null;
let api: WorkerApi | null = null;

function getWorker(): WorkerApi {
  if (!api) {
    worker = new Worker(new URL('../workers/pipeline.worker.ts', import.meta.url), { type: 'module' });
    api = Comlink.wrap<WorkerApi>(worker);
  }
  return api;
}

// coalescing: only one render in flight at a time; queue latest params
let inFlight = false;
let pending: (() => void) | null = null;

export async function renderStack(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  stack: StackEntry[],
  onResult: (r: RenderResult) => void,
): Promise<void> {
  const run = async () => {
    inFlight = true;
    try {
      // transfer a copy so the original stays intact
      const copy = new Uint8ClampedArray(pixels);
      const result = await getWorker().runStack({ pixels: copy, width, height, stack });
      onResult(result);
    } finally {
      inFlight = false;
      if (pending) {
        const next = pending;
        pending = null;
        next();
      }
    }
  };

  if (inFlight) {
    pending = run;
  } else {
    run();
  }
}

export function terminateWorker() {
  worker?.terminate();
  worker = null;
  api = null;
}

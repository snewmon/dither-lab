import * as Comlink from 'comlink';
import { getEffect } from '../effects/registry';
import type { RenderRequest, RenderResult } from '../engine/types';

const api = {
  runStack(req: RenderRequest): RenderResult {
    let pixels = req.pixels;
    let { width, height } = req;

    for (const entry of req.stack) {
      if (!entry.enabled) continue;
      const effect = getEffect(entry.effectId);
      if (!effect || effect.kind !== 'pixel') continue;
      pixels = effect.apply(pixels, width, height, entry.params as never, entry.seed);
    }

    return { pixels, width, height };
  },
};

Comlink.expose(api);

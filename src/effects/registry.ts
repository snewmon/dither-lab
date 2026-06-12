import type { EffectDef } from '../engine/types';
import { bayerEffect } from './dither/bayer';
import { floydSteinbergEffect, atkinsonEffect } from './dither/errorDiffusion';

const effects: Map<string, EffectDef> = new Map();

function register(e: EffectDef) {
  effects.set(e.id, e);
}

register(bayerEffect);
register(floydSteinbergEffect);
register(atkinsonEffect);

export function getEffect(id: string): EffectDef | undefined {
  return effects.get(id);
}

export function listEffects(): EffectDef[] {
  return [...effects.values()];
}

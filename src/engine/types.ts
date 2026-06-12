export type EffectKind = 'pixel' | 'bytes';

export interface ParamSchema {
  [key: string]: ParamDef;
}

export type ParamDef =
  | { type: 'select'; options: string[]; default: string }
  | { type: 'range'; min: number; max: number; step: number; default: number }
  | { type: 'color'; default: string }
  | { type: 'toggle'; default: boolean };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface EffectDef<P = any> {
  id: string;
  label: string;
  kind: EffectKind;
  params: ParamSchema;
  defaults: P;
  apply(input: Uint8ClampedArray, width: number, height: number, params: P, seed: number): Uint8ClampedArray;
}

export interface StackEntry {
  effectId: string;
  params: Record<string, unknown>;
  seed: number;
  enabled: boolean;
}

export interface RenderRequest {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
  stack: StackEntry[];
}

export interface RenderResult {
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}

import type { EffectDef } from '../../engine/types';
import { nearestColor, PALETTES, type PaletteId } from './palette';
import { srgbToLinear, linearToSrgb } from './gamma';

const BAYER2 = [0, 2, 3, 1].map(v => v / 4);
const BAYER4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5,
].map(v => v / 16);
const BAYER8 = (() => {
  const b4 = BAYER4;
  const m: number[] = new Array(64);
  for (let y = 0; y < 8; y++)
    for (let x = 0; x < 8; x++) {
      const bx = x % 4, by = y % 4;
      const qx = Math.floor(x / 4), qy = Math.floor(y / 4);
      const base = b4[by * 4 + bx];
      const quad = BAYER2[qy * 2 + qx];
      m[y * 8 + x] = base * 0.25 + quad * 0.25;
    }
  return m;
})();

const MATRICES: Record<string, { mat: number[]; size: number }> = {
  '2': { mat: BAYER2, size: 2 },
  '4': { mat: BAYER4, size: 4 },
  '8': { mat: BAYER8, size: 8 },
};

export interface BayerParams {
  matrix: '2' | '4' | '8';
  palette: PaletteId;
  gamma: boolean;
  brightness: number;
  contrast: number;
  scale: number;
}

export const bayerEffect: EffectDef<BayerParams> = {
  id: 'bayer',
  label: 'Ordered (Bayer)',
  kind: 'pixel',
  params: {
    matrix:     { type: 'select', options: ['2', '4', '8'], default: '4' },
    palette:    { type: 'select', options: Object.keys(PALETTES), default: '1bit' },
    gamma:      { type: 'toggle', default: true },
    brightness: { type: 'range', min: -100, max: 100, step: 1, default: 0 },
    contrast:   { type: 'range', min: -100, max: 100, step: 1, default: 0 },
    scale:      { type: 'select', options: ['1', '2', '4'], default: '1' },
  },
  defaults: { matrix: '4', palette: '1bit', gamma: true, brightness: 0, contrast: 0, scale: '1' } as unknown as BayerParams,

  apply(input, width, height, params) {
    const { mat, size } = MATRICES[params.matrix];
    const palette = PALETTES[params.palette];
    const scale = parseInt(params.scale as unknown as string, 10) || 1;
    const pw = Math.ceil(width  / scale);
    const ph = Math.ceil(height / scale);
    const output = new Uint8ClampedArray(width * height * 4);
    const bright = params.brightness / 100;
    const cont   = (params.contrast  + 100) / 100;

    for (let py = 0; py < ph; py++) {
      for (let px = 0; px < pw; px++) {
        const sx = px * scale, sy = py * scale;
        const idx = (sy * width + sx) * 4;
        let r = input[idx], g = input[idx+1], b = input[idx+2];

        // brightness / contrast in linear if gamma-aware
        if (params.gamma) {
          let lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
          lr = Math.max(0, Math.min(1, (lr + bright) * cont));
          lg = Math.max(0, Math.min(1, (lg + bright) * cont));
          lb = Math.max(0, Math.min(1, (lb + bright) * cont));
          r = linearToSrgb(lr); g = linearToSrgb(lg); b = linearToSrgb(lb);
        } else {
          r = Math.max(0, Math.min(255, r + bright * 255));
          g = Math.max(0, Math.min(255, g + bright * 255));
          b = Math.max(0, Math.min(255, b + bright * 255));
          r = Math.max(0, Math.min(255, (r - 128) * cont + 128));
          g = Math.max(0, Math.min(255, (g - 128) * cont + 128));
          b = Math.max(0, Math.min(255, (b - 128) * cont + 128));
        }

        const threshold = mat[(py % size) * size + (px % size)];
        // shift pixel by threshold (spread over palette step)
        const step = 255 / Math.max(1, palette.length - 1);
        const tr = Math.max(0, Math.min(255, r + (threshold - 0.5) * step));
        const tg = Math.max(0, Math.min(255, g + (threshold - 0.5) * step));
        const tb = Math.max(0, Math.min(255, b + (threshold - 0.5) * step));
        const nearest = nearestColor(tr, tg, tb, palette);

        for (let dy = 0; dy < scale && sy + dy < height; dy++) {
          for (let dx = 0; dx < scale && sx + dx < width; dx++) {
            const oi = ((sy + dy) * width + (sx + dx)) * 4;
            output[oi]   = nearest.r;
            output[oi+1] = nearest.g;
            output[oi+2] = nearest.b;
            output[oi+3] = 255;
          }
        }
      }
    }
    return output;
  },
};

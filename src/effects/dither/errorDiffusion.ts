import { nearestColor, PALETTES, type PaletteId } from './palette';
import { srgbToLinear, linearToSrgb } from './gamma';
import type { EffectDef } from '../../engine/types';

type KernelEntry = [dr: number, dc: number, weight: number];

const FLOYD_STEINBERG: KernelEntry[] = [
  [0,  1, 7/16],
  [1, -1, 3/16],
  [1,  0, 5/16],
  [1,  1, 1/16],
];

const ATKINSON: KernelEntry[] = [
  [0,  1, 1/8],
  [0,  2, 1/8],
  [1, -1, 1/8],
  [1,  0, 1/8],
  [1,  1, 1/8],
  [2,  0, 1/8],
];

export interface ErrorDiffusionParams {
  algorithm: 'floyd-steinberg' | 'atkinson';
  palette: PaletteId;
  gamma: boolean;
  brightness: number;
  contrast: number;
  scale: number;
}

function makeEffect(id: string, label: string, algorithm: 'floyd-steinberg' | 'atkinson'): EffectDef<ErrorDiffusionParams> {
  return {
    id,
    label,
    kind: 'pixel',
    params: {
      palette:    { type: 'select', options: Object.keys(PALETTES), default: '1bit' },
      gamma:      { type: 'toggle', default: true },
      brightness: { type: 'range', min: -100, max: 100, step: 1, default: 0 },
      contrast:   { type: 'range', min: -100, max: 100, step: 1, default: 0 },
      scale:      { type: 'select', options: ['1', '2', '4'], default: '1' },
    },
    defaults: { algorithm, palette: '1bit', gamma: true, brightness: 0, contrast: 0, scale: 1 } as unknown as ErrorDiffusionParams,

    apply(input, width, height, params) {
      const palette = PALETTES[params.palette];
      const kernel  = algorithm === 'atkinson' ? ATKINSON : FLOYD_STEINBERG;
      const scale   = typeof params.scale === 'string' ? parseInt(params.scale, 10) : params.scale || 1;
      const pw = Math.ceil(width  / scale);
      const ph = Math.ceil(height / scale);
      const bright = params.brightness / 100;
      const cont   = (params.contrast  + 100) / 100;

      // working buffer in linear float space
      const buf = new Float32Array(pw * ph * 3);
      for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
          const sx = Math.min(px * scale, width  - 1);
          const sy = Math.min(py * scale, height - 1);
          const si = (sy * width + sx) * 4;
          let r = input[si], g = input[si+1], b = input[si+2];

          if (params.gamma) {
            let lr = srgbToLinear(r), lg = srgbToLinear(g), lb = srgbToLinear(b);
            lr = Math.max(0, Math.min(1, (lr + bright) * cont));
            lg = Math.max(0, Math.min(1, (lg + bright) * cont));
            lb = Math.max(0, Math.min(1, (lb + bright) * cont));
            buf[(py * pw + px) * 3]     = lr;
            buf[(py * pw + px) * 3 + 1] = lg;
            buf[(py * pw + px) * 3 + 2] = lb;
          } else {
            r = Math.max(0, Math.min(255, (r - 128) * cont + 128 + bright * 255));
            g = Math.max(0, Math.min(255, (g - 128) * cont + 128 + bright * 255));
            b = Math.max(0, Math.min(255, (b - 128) * cont + 128 + bright * 255));
            buf[(py * pw + px) * 3]     = r / 255;
            buf[(py * pw + px) * 3 + 1] = g / 255;
            buf[(py * pw + px) * 3 + 2] = b / 255;
          }
        }
      }

      const output = new Uint8ClampedArray(width * height * 4);

      for (let py = 0; py < ph; py++) {
        for (let px = 0; px < pw; px++) {
          const bi = (py * pw + px) * 3;
          const cr = params.gamma ? linearToSrgb(buf[bi])     : Math.round(buf[bi]     * 255);
          const cg = params.gamma ? linearToSrgb(buf[bi + 1]) : Math.round(buf[bi + 1] * 255);
          const cb = params.gamma ? linearToSrgb(buf[bi + 2]) : Math.round(buf[bi + 2] * 255);

          const nearest = nearestColor(cr, cg, cb, palette);

          // error in linear (or raw) space
          const er = buf[bi]     - (params.gamma ? srgbToLinear(nearest.r) : nearest.r / 255);
          const eg = buf[bi + 1] - (params.gamma ? srgbToLinear(nearest.g) : nearest.g / 255);
          const eb = buf[bi + 2] - (params.gamma ? srgbToLinear(nearest.b) : nearest.b / 255);

          for (const [dr, dc, w] of kernel) {
            const ny = py + dr, nx = px + dc;
            if (nx < 0 || nx >= pw || ny >= ph) continue;
            const ni = (ny * pw + nx) * 3;
            buf[ni]     += er * w;
            buf[ni + 1] += eg * w;
            buf[ni + 2] += eb * w;
          }

          for (let dy = 0; dy < scale && py * scale + dy < height; dy++) {
            for (let dx = 0; dx < scale && px * scale + dx < width; dx++) {
              const oi = ((py * scale + dy) * width + (px * scale + dx)) * 4;
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
}

export const floydSteinbergEffect = makeEffect('floyd-steinberg', 'Floyd–Steinberg', 'floyd-steinberg');
export const atkinsonEffect       = makeEffect('atkinson',        'Atkinson',        'atkinson');

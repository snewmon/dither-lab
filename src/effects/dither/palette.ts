export interface Color { r: number; g: number; b: number }

export type PaletteId = '1bit' | 'grayscale4' | 'grayscale8' | 'gameboy' | 'cga' | 'amber';

export const PALETTES: Record<PaletteId, Color[]> = {
  '1bit': [
    { r: 10,  g: 14,  b: 20  },  // black
    { r: 200, g: 232, b: 255 },  // white
  ],
  'grayscale4': [
    { r: 0,   g: 0,   b: 0   },
    { r: 85,  g: 85,  b: 85  },
    { r: 170, g: 170, b: 170 },
    { r: 255, g: 255, b: 255 },
  ],
  'grayscale8': Array.from({ length: 8 }, (_, i) => {
    const v = Math.round(i * 255 / 7);
    return { r: v, g: v, b: v };
  }),
  'gameboy': [
    { r: 15,  g: 56,  b: 15  },
    { r: 48,  g: 98,  b: 48  },
    { r: 139, g: 172, b: 15  },
    { r: 155, g: 188, b: 15  },
  ],
  'cga': [
    { r: 0,   g: 0,   b: 0   },
    { r: 85,  g: 255, b: 255 },
    { r: 255, g: 85,  b: 255 },
    { r: 255, g: 255, b: 255 },
  ],
  'amber': [
    { r: 20,  g: 12,  b: 0   },
    { r: 255, g: 176, b: 0   },
  ],
};

export function nearestColor(r: number, g: number, b: number, palette: Color[]): Color {
  let best = palette[0];
  let bestDist = Infinity;
  for (const c of palette) {
    const dr = r - c.r, dg = g - c.g, db = b - c.b;
    const d = dr*dr + dg*dg + db*db;
    if (d < bestDist) { bestDist = d; best = c; }
  }
  return best;
}

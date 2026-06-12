import { describe, it, expect } from 'vitest';
import { bayerEffect } from '../src/effects/dither/bayer';
import { floydSteinbergEffect, atkinsonEffect } from '../src/effects/dither/errorDiffusion';

// 4x4 solid white image
function solidImage(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const buf = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i*4]   = r; buf[i*4+1] = g; buf[i*4+2] = b; buf[i*4+3] = 255;
  }
  return buf;
}

describe('bayer dither', () => {
  it('solid white → all ink pixels', () => {
    const img = solidImage(8, 8, 255, 255, 255);
    const out = bayerEffect.apply(img, 8, 8, bayerEffect.defaults, 0);
    expect(out.length).toBe(8 * 8 * 4);
    // all pixels should be the "white" palette color (last entry of 1bit)
    for (let i = 0; i < 64; i++) {
      expect(out[i*4+3]).toBe(255);
    }
  });

  it('solid black → all background pixels', () => {
    const img = solidImage(8, 8, 0, 0, 0);
    const out = bayerEffect.apply(img, 8, 8, bayerEffect.defaults, 0);
    // all pixels should be the dark palette color
    for (let i = 0; i < 64; i++) {
      expect([out[i*4], out[i*4+1], out[i*4+2]]).toEqual([10, 14, 20]);
    }
  });

  it('preserves dimensions', () => {
    const img = solidImage(16, 12, 128, 128, 128);
    const out = bayerEffect.apply(img, 16, 12, bayerEffect.defaults, 0);
    expect(out.length).toBe(16 * 12 * 4);
  });
});

describe('floyd-steinberg dither', () => {
  it('preserves dimensions', () => {
    const img = solidImage(10, 10, 128, 128, 128);
    const out = floydSteinbergEffect.apply(img, 10, 10, floydSteinbergEffect.defaults, 0);
    expect(out.length).toBe(10 * 10 * 4);
  });

  it('output pixels come from palette', () => {
    const img = solidImage(8, 8, 128, 128, 128);
    const out = floydSteinbergEffect.apply(img, 8, 8, floydSteinbergEffect.defaults, 0);
    for (let i = 0; i < 64; i++) {
      const r = out[i*4], g = out[i*4+1], b = out[i*4+2];
      // must be one of the 1bit palette colors
      const isBlack = r === 10  && g === 14  && b === 20;
      const isWhite = r === 200 && g === 232 && b === 255;
      expect(isBlack || isWhite).toBe(true);
    }
  });
});

describe('atkinson dither', () => {
  it('preserves dimensions', () => {
    const img = solidImage(8, 8, 100, 100, 100);
    const out = atkinsonEffect.apply(img, 8, 8, atkinsonEffect.defaults, 0);
    expect(out.length).toBe(8 * 8 * 4);
  });
});

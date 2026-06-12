// No-WebGL static fallback: a CPU-rendered 1-bit Bayer dither of a simple gradient
export function drawStaticFallback(canvas: HTMLCanvasElement): void {
  const w = canvas.width  || window.innerWidth;
  const h = canvas.height || window.innerHeight;
  canvas.width  = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bayer4 = [
     0,  8,  2, 10,
    12,  4, 14,  6,
     3, 11,  1,  9,
    15,  7, 13,  5,
  ].map(v => v / 16);

  const img = ctx.createImageData(w, h);
  const d   = img.data;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lum = 0.3 + 0.4 * (x / w) + 0.2 * Math.sin((x + y) * 0.02);
      const threshold = bayer4[(y % 4) * 4 + (x % 4)];
      const ink = lum > threshold ? 1 : 0;
      const i = (y * w + x) * 4;
      if (ink) {
        // pale cyan
        d[i]   = 126; d[i+1] = 200; d[i+2] = 227;
      } else {
        // prussian blue bg
        d[i]   = 10;  d[i+1] = 14;  d[i+2] = 20;
      }
      d[i+3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

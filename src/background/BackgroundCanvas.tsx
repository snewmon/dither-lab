import { useEffect, useRef } from 'preact/hooks';
import { createGLBackground, type GLBackground, type PaletteUniforms } from './glBackground';
import { drawStaticFallback } from './staticFallback';
import { imagePalette, isRendering } from '../engine/imageStore';
import './BackgroundCanvas.css';

// smooth blend toward target palette value
let currentBlend = 0;
let targetBlend  = 0;

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let gl: GLBackground | null = null;
    let rafId = 0;
    let startTime = performance.now();

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = Math.round(window.innerWidth  * dpr);
      const h = Math.round(window.innerHeight * dpr);
      if (gl) gl.resize(w, h);
      else { canvas.width = w; canvas.height = h; }
    };

    const loop = () => {
      // pause while a worker render is in flight
      if (document.hidden || isRendering.value) {
        rafId = requestAnimationFrame(loop);
        return;
      }

      const t = (performance.now() - startTime) * 0.001;

      // build palette uniforms, blend toward image palette when one is loaded
      const pal = imagePalette.value;
      targetBlend = pal.length >= 4 ? 1.0 : 0.0;
      currentBlend += (targetBlend - currentBlend) * 0.02; // slow lerp

      const palette: PaletteUniforms | undefined = pal.length >= 4
        ? { colours: pal.slice(0, 4) as [number,number,number][], blend: currentBlend }
        : undefined;

      gl?.draw(t, palette);
      rafId = requestAnimationFrame(loop);
    };

    gl = createGLBackground(canvas);
    resize();

    if (prefersReduced || !gl) {
      if (gl) gl.draw(0);
      else drawStaticFallback(canvas);
    } else {
      loop();
    }

    const ro = new ResizeObserver(resize);
    ro.observe(document.documentElement);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      gl?.destroy();
    };
  }, []);

  return <canvas ref={canvasRef} class="bg-canvas" aria-hidden="true" />;
}

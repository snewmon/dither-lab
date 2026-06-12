import { signal, computed, batch } from '@preact/signals';
import type { StackEntry } from './types';

const MAX_PREVIEW_PIXELS = 1_500_000;
const STORAGE_KEY = 'ditherlab_stack';
const HISTORY_LIMIT = 50;

export interface SourceImage {
  bitmap: ImageBitmap;
  fullWidth: number;
  fullHeight: number;
  previewPixels: Uint8ClampedArray;
  previewWidth: number;
  previewHeight: number;
  name: string;
}

export const sourceImage   = signal<SourceImage | null>(null);
export const stack         = signal<StackEntry[]>(loadStackFromStorage());
export const previewResult = signal<{ pixels: Uint8ClampedArray; width: number; height: number } | null>(null);
export const isRendering   = signal(false);
export const pixelZoom     = signal(false);
export const imagePalette  = signal<[number, number, number][]>([]);

export const activeStack = computed(() => stack.value.filter(e => e.enabled));

// undo/redo: plain arrays, not signals, avoids reactive cycles
const _history: StackEntry[][] = [stack.peek()];
let   _histIdx                  = 0;
export const canUndo = signal(false);
export const canRedo = signal(false);

// all stack writes go through here: history, localStorage, undo signal updates
function _setStack(next: StackEntry[], recordHistory = true) {
  if (recordHistory) {
    _history.splice(_histIdx + 1);           // drop redo future
    _history.push(next);
    if (_history.length > HISTORY_LIMIT) _history.shift();
    _histIdx = _history.length - 1;
  }
  // write all signals together so one batch causes one re-render
  batch(() => {
    stack.value    = next;
    canUndo.value  = _histIdx > 0;
    canRedo.value  = _histIdx < _history.length - 1;
  });
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* quota */ }
}

export function undo() {
  if (_histIdx <= 0) return;
  _histIdx--;
  _setStack(_history[_histIdx], false);
}

export function redo() {
  if (_histIdx >= _history.length - 1) return;
  _histIdx++;
  _setStack(_history[_histIdx], false);
}

function loadStackFromStorage(): StackEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StackEntry[];
  } catch { /* ignore */ }
  return [];
}

export async function loadImage(file: File | Blob, name = 'image') {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width: fw, height: fh } = bitmap;

  let pw = fw, ph = fh;
  const totalPixels = fw * fh;
  if (totalPixels > MAX_PREVIEW_PIXELS) {
    const scale = Math.sqrt(MAX_PREVIEW_PIXELS / totalPixels);
    pw = Math.round(fw * scale);
    ph = Math.round(fh * scale);
  }

  const offscreen = new OffscreenCanvas(pw, ph);
  const ctx = offscreen.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, pw, ph);
  const imageData = ctx.getImageData(0, 0, pw, ph);

  batch(() => {
    sourceImage.value  = { bitmap, fullWidth: fw, fullHeight: fh,
                           previewPixels: imageData.data,
                           previewWidth: pw, previewHeight: ph, name };
    previewResult.value = null;
    imagePalette.value  = extractPalette(imageData.data, 4);
  });
}

function extractPalette(data: Uint8ClampedArray, count: number): [number, number, number][] {
  const step = Math.max(1, Math.floor(data.length / 4 / 2000));
  const samples: [number, number, number][] = [];
  for (let i = 0; i < data.length; i += step * 4) {
    samples.push([data[i] / 255, data[i + 1] / 255, data[i + 2] / 255]);
  }
  let centres = samples.slice(0, count).map(c => [...c] as [number, number, number]);
  for (let iter = 0; iter < 8; iter++) {
    const sums: [number, number, number][] = centres.map(() => [0, 0, 0]);
    const counts = new Array(count).fill(0);
    for (const s of samples) {
      let best = 0, bestD = Infinity;
      for (let k = 0; k < count; k++) {
        const d = (s[0]-centres[k][0])**2 + (s[1]-centres[k][1])**2 + (s[2]-centres[k][2])**2;
        if (d < bestD) { bestD = d; best = k; }
      }
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2];
      counts[best]++;
    }
    for (let k = 0; k < count; k++) {
      if (counts[k] > 0) centres[k] = [sums[k][0]/counts[k], sums[k][1]/counts[k], sums[k][2]/counts[k]];
    }
  }
  return centres;
}

export function addEffect(effectId: string, params: Record<string, unknown>) {
  _setStack([...stack.value, { effectId, params, seed: randomSeed(), enabled: true }]);
}

export function removeEffect(index: number) {
  _setStack(stack.value.filter((_, i) => i !== index));
}

export function updateEffect(index: number, params: Record<string, unknown>) {
  _setStack(stack.value.map((e, i) => i === index ? { ...e, params } : e));
}

export function toggleEffect(index: number) {
  _setStack(stack.value.map((e, i) => i === index ? { ...e, enabled: !e.enabled } : e));
}

export function reorderEffect(from: number, to: number) {
  const s = [...stack.value];
  const [moved] = s.splice(from, 1);
  s.splice(to, 0, moved);
  _setStack(s);
}

export function reseedEffect(index: number) {
  _setStack(stack.value.map((e, i) => i === index ? { ...e, seed: randomSeed() } : e));
}

export function clearStack() {
  _setStack([]);
}

function randomSeed() {
  return Math.floor(Math.random() * 0xffffffff);
}

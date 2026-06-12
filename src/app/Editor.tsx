import { useEffect, useRef } from 'preact/hooks';
import { useSignal, useComputed } from '@preact/signals';
import {
  sourceImage, stack, previewResult, isRendering, pixelZoom,
  addEffect, removeEffect, updateEffect, toggleEffect, reorderEffect, reseedEffect,
  loadImage, undo, redo, canUndo, canRedo, clearStack,
} from '../engine/imageStore';
import { renderStack } from '../engine/pipeline';
import { listEffects } from '../effects/registry';
import { ParamControl } from './ParamControl';
import { appState } from './App';
import './Editor.css';

export function Editor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging  = useSignal<number | null>(null);
  const dragOver  = useSignal<number | null>(null);

  const effects = listEffects();

  // access .value inside render so Preact tracks the signals
  const src    = sourceImage.value;
  const stk    = stack.value;
  const result = previewResult.value;
  const zoom   = pixelZoom.value;
  const rendering = isRendering.value;

  // Re-run pipeline when source or stack changes
  useEffect(() => {
    const s = sourceImage.value;
    if (!s) return;
    if (stack.value.length === 0) {
      previewResult.value = { pixels: s.previewPixels, width: s.previewWidth, height: s.previewHeight };
      return;
    }
    isRendering.value = true;
    renderStack(s.previewPixels, s.previewWidth, s.previewHeight, stack.value, r => {
      previewResult.value = r;
      isRendering.value = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, stk]);

  // Draw result to canvas
  useEffect(() => {
    const r = previewResult.value;
    const canvas = canvasRef.current;
    if (!canvas || !r || r.width === 0) return;
    canvas.width  = r.width;
    canvas.height = r.height;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.pixels), r.width, r.height), 0, 0);
  }, [result]);

  // Keyboard shortcuts: Cmd/Ctrl+Z / Shift+Z for undo/redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.key === 'z' && e.shiftKey) || e.key === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files[0];
    if (file?.type.startsWith('image/')) loadImage(file, file.name);
  };

  const handleFileInput = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) loadImage(file, file.name);
  };

  const handlePaste = (e: ClipboardEvent) => {
    const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
    if (item) { const blob = item.getAsFile(); if (blob) loadImage(blob); }
  };

  useEffect(() => {
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, []);

  const exportPng = async () => {
    const s = sourceImage.value;
    if (!s) return;
    const offscreen = new OffscreenCanvas(s.fullWidth, s.fullHeight);
    const ctx = offscreen.getContext('2d')!;
    ctx.drawImage(s.bitmap, 0, 0);
    const fullData = ctx.getImageData(0, 0, s.fullWidth, s.fullHeight);
    if (stack.value.length === 0) { downloadCanvas(offscreen, s.name); return; }
    isRendering.value = true;
    renderStack(fullData.data, s.fullWidth, s.fullHeight, stack.value, r => {
      isRendering.value = false;
      const out = new OffscreenCanvas(r.width, r.height);
      out.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(r.pixels), r.width, r.height), 0, 0);
      downloadCanvas(out, s.name);
    });
  };

  // Drag reorder helpers
  const onDragStart = (i: number) => { dragging.value = i; };
  const onDragEnter = (i: number) => { dragOver.value = i; };
  const onDragEnd   = () => {
    if (dragging.value !== null && dragOver.value !== null && dragging.value !== dragOver.value) {
      reorderEffect(dragging.value, dragOver.value);
    }
    dragging.value = null;
    dragOver.value = null;
  };

  return (
    <div class="editor" onDragOver={e => e.preventDefault()} onDrop={handleDrop}>
      <aside class="editor-sidebar">
        {/* header */}
        <div class="sidebar-header">
          <button class="back-btn" onClick={() => { appState.value = 'landing'; }}>← back</button>
          <span class="sidebar-title">DITHERLAB</span>
          <div class="undo-redo">
            <button class="icon-btn" onClick={undo}  disabled={!canUndo.value}  title="Undo (⌘Z)">↺</button>
            <button class="icon-btn" onClick={redo}  disabled={!canRedo.value}  title="Redo (⌘⇧Z)">↻</button>
          </div>
        </div>

        {/* effect picker */}
        <div class="sidebar-section">
          <div class="sidebar-label">add effect</div>
          <div class="effect-list">
            {effects.map(ef => (
              <button key={ef.id} class="add-effect-btn"
                onClick={() => addEffect(ef.id, { ...ef.defaults })}>
                + {ef.label}
              </button>
            ))}
          </div>
        </div>

        {/* stack */}
        <div class="sidebar-section stack-section">
          <div class="sidebar-label-row">
            <span class="sidebar-label">stack</span>
            {stk.length > 0 && (
              <button class="clear-btn" onClick={clearStack}>clear</button>
            )}
          </div>
          {stk.length === 0 && <div class="stack-empty">no effects. add one above</div>}
          {stk.map((entry, i) => {
            const ef = effects.find(e => e.id === entry.effectId);
            if (!ef) return null;
            const isDraggingOver = dragOver.value === i && dragging.value !== i;
            return (
              <div
                key={`${entry.effectId}-${i}`}
                class={`stack-entry ${entry.enabled ? '' : 'disabled'} ${isDraggingOver ? 'drag-over' : ''}`}
                draggable
                onDragStart={() => onDragStart(i)}
                onDragEnter={() => onDragEnter(i)}
                onDragEnd={onDragEnd}
              >
                <div class="stack-entry-header">
                  <span class="drag-handle" title="Drag to reorder">⠿</span>
                  <button class="toggle-btn" onClick={() => toggleEffect(i)}>
                    {entry.enabled ? '●' : '○'}
                  </button>
                  <span class="stack-entry-label">{ef.label}</span>
                  <button class="reseed-btn" onClick={() => reseedEffect(i)} title="Randomize seed">⟳</button>
                  <button class="remove-btn" onClick={() => removeEffect(i)}>✕</button>
                </div>
                <div class="stack-params">
                  {Object.entries(ef.params).map(([key, def]) => (
                    <ParamControl key={key} label={key} def={def}
                      value={entry.params[key] ?? def.default}
                      onChange={v => updateEffect(i, { ...entry.params, [key]: v })}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div class="sidebar-footer">
          <button class="export-btn" onClick={exportPng} disabled={!src}>export PNG</button>
          {rendering && <span class="rendering-badge">rendering</span>}
        </div>
      </aside>

      <main class="editor-viewport">
        {!src ? (
          <div class="dropzone">
            <div class="dropzone-inner">
              <div class="dropzone-icon">⬡</div>
              <div class="dropzone-text">drop an image, paste, or</div>
              <label class="dropzone-pick">
                browse
                <input type="file" accept="image/*" onChange={handleFileInput} hidden />
              </label>
            </div>
          </div>
        ) : (
          <div class={`canvas-wrap ${zoom ? 'zoom-1to1' : 'zoom-fit'}`}>
            <canvas ref={canvasRef} class="preview-canvas" />
          </div>
        )}

        {src && (
          <div class="viewport-toolbar">
            <button class={`zoom-btn ${zoom ? 'active' : ''}`}
              onClick={() => { pixelZoom.value = !pixelZoom.value; }}>
              {zoom ? '1:1' : 'fit'}
            </button>
            <span class="img-info">
              {src.previewWidth}×{src.previewHeight}
              {src.previewWidth !== src.fullWidth ? ` (full: ${src.fullWidth}×${src.fullHeight})` : ''}
            </span>
            <label class="swap-btn">
              swap image
              <input type="file" accept="image/*" onChange={handleFileInput} hidden />
            </label>
          </div>
        )}
      </main>
    </div>
  );
}

async function downloadCanvas(canvas: OffscreenCanvas, originalName: string) {
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = originalName.replace(/\.[^.]+$/, '') + '_dithered.png';
  a.click();
  URL.revokeObjectURL(url);
}

import { signal } from '@preact/signals';
import { BackgroundCanvas } from '../background/BackgroundCanvas';
import { Landing } from './Landing';
import { Editor } from './Editor';
import './App.css';

export type AppView = 'landing' | 'transitioning' | 'editor';
export const appState = signal<AppView>('landing');

export function openEditor() {
  appState.value = 'transitioning';
  // after glitch transition, swap to editor
  setTimeout(() => { appState.value = 'editor'; }, 700);
}

export function App() {
  const view = appState.value;
  return (
    <div class="app-root">
      <BackgroundCanvas />
      {view !== 'editor' && <Landing />}
      {view === 'editor' && <Editor />}
      {view === 'transitioning' && <div class="glitch-overlay" />}
    </div>
  );
}

import { openEditor } from './App';
import './Landing.css';

export function Landing() {
  return (
    <div class="landing">
      <div class="landing-inner">
        <div class="wordmark">
          <span class="wordmark-dither">DITHER</span>
          <span class="wordmark-lab">LAB</span>
        </div>
        <p class="tagline">destructive image processing.</p>
        <button
          class="open-btn"
          onClick={openEditor}
        >
          <span class="open-btn-bracket">[</span>
          open the tool
          <span class="open-btn-bracket">]</span>
        </button>
      </div>
      <div class="corner-label corner-tl">v0.1</div>
      <div class="corner-label corner-br">images stay on your machine</div>
    </div>
  );
}

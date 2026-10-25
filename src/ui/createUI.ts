// Controls panel. Owned by the UI worker.
import GUI from 'lil-gui';
import type { TreeParams } from '../contracts';
import { advanceTime, formatClock, nextSeed, queryFromParams } from './urlSync';

/** One full day of the "cycle day" toggle takes this many real seconds. */
const DAY_SECONDS = 180;
/** How often "cycle day" advances the clock. 10 Hz is smooth for a slow sun and cheap for setTimeOfDay. */
const CYCLE_HZ = 10;
/** The URL is rewritten at most this often; Safari throws after 100 history calls in 30 s. */
const URL_SYNC_MS = 1000;
/** The help hint stays fully visible this long before fading. */
const HELP_MS = 6000;

const STYLE = `
.trees-gui.lil-gui.lil-root {
  --background-color: rgba(28, 22, 30, 0.72);
  --widget-color: rgba(255, 255, 255, 0.12);
  --hover-color: rgba(255, 255, 255, 0.18);
  --focus-color: rgba(255, 255, 255, 0.24);
  --number-color: #ffc6d9;
  --string-color: #ffc6d9;
  --title-background-color: rgba(18, 12, 20, 0.6);
  --font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-size: 12px;
  --widget-height: 22px;
  --name-width: 38%;
  border-radius: 10px;
  overflow: hidden;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.25);
  top: 12px; right: 12px;
}
.trees-help {
  position: fixed; left: 16px; bottom: 16px; z-index: 10;
  padding: 8px 14px; border-radius: 999px;
  background: rgba(28, 22, 30, 0.55); color: rgba(255, 255, 255, 0.92);
  font: 13px/1.4 system-ui, -apple-system, "Segoe UI", sans-serif; letter-spacing: 0.01em;
  backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
  pointer-events: none; user-select: none;
  transition: opacity 1.2s ease;
}
.trees-help small { display: block; opacity: 0.7; font-size: 11px; }
.trees-help.faded { opacity: 0; }
`;

/** `onChange` is called with the full new params whenever the user changes anything. */
export function createUI(params: TreeParams, onChange: (next: TreeParams) => void): { dispose(): void } {
  const style = document.createElement('style');
  style.textContent = STYLE;
  document.head.appendChild(style);

  // lil-gui edits this object in place; `current` is what onChange receives.
  const state = { seed: params.seed, age: params.age, timeOfDay: params.timeOfDay, wind: params.wind, leafDensity: params.leafDensity, cycleDay: false, newTree: () => {} };
  const current = (): TreeParams => ({ seed: state.seed, age: state.age, timeOfDay: state.timeOfDay, wind: state.wind, leafDensity: state.leafDensity });

  let urlTimer: ReturnType<typeof setTimeout> | null = null;
  let lastUrlWrite = 0;
  const writeUrl = (): void => {
    urlTimer = null;
    lastUrlWrite = Date.now();
    const query = queryFromParams(window.location.search, current());
    history.replaceState(history.state, '', `${window.location.pathname}${query}${window.location.hash}`);
  };
  const syncUrl = (): void => {
    if (urlTimer) return;
    urlTimer = setTimeout(writeUrl, Math.max(0, URL_SYNC_MS - (Date.now() - lastUrlWrite)));
  };
  const emit = (): void => { onChange(current()); syncUrl(); };

  const gui = new GUI({ title: 'Cherry blossom', width: 260 });
  gui.domElement.classList.add('trees-gui');

  state.newTree = () => { state.seed = nextSeed(Math.random(), state.seed); seedCtl.updateDisplay(); emit(); };
  gui.add(state, 'newTree').name('New tree');
  // Regrowing costs a full rebuild, so seed, age and blossoms apply when the user lets go.
  const seedCtl = gui.add(state, 'seed').min(0).step(1).name('Seed').onFinishChange(emit);
  gui.add(state, 'age', 0, 1, 0.01).name('Age').onFinishChange(emit);
  gui.add(state, 'leafDensity', 0, 1, 0.01).name('Blossoms').onFinishChange(emit);
  const timeCtl = gui.add(state, 'timeOfDay', 0, 24, 0.05).decimals(2).name('Time').onChange(() => { showClock(); emit(); });
  gui.add(state, 'cycleDay').name('Cycle day').onChange(() => { lastTick = performance.now(); });
  gui.add(state, 'wind', 0, 1, 0.01).name('Wind').onChange(emit);

  // A clock readout ("17:30") next to the time slider's name.
  const clock = document.createElement('span');
  clock.style.cssText = 'opacity:0.6;margin-left:6px;font-variant-numeric:tabular-nums';
  timeCtl.$name.appendChild(clock);
  const showClock = (): void => { clock.textContent = formatClock(state.timeOfDay); };
  showClock();

  // "Cycle day" runs on its own timer so main.ts needs no per-frame hook.
  let lastTick = performance.now();
  const cycle = setInterval(() => {
    const now = performance.now();
    const dt = Math.min(1, (now - lastTick) / 1000);
    lastTick = now;
    if (!state.cycleDay || document.hidden) return;
    state.timeOfDay = advanceTime(state.timeOfDay, (24 * dt) / DAY_SECONDS);
    timeCtl.updateDisplay();
    showClock();
    emit();
  }, 1000 / CYCLE_HZ);

  const help = document.createElement('div');
  help.className = 'trees-help';
  help.innerHTML = 'WASD move · drag to look · scroll to zoom<small>Space/E up · Q/C down · hold Shift to go faster</small>';
  document.body.appendChild(help);
  const fade = setTimeout(() => help.classList.add('faded'), HELP_MS);

  return {
    dispose() {
      clearInterval(cycle);
      clearTimeout(fade);
      if (urlTimer) clearTimeout(urlTimer);
      gui.destroy();
      help.remove();
      style.remove();
    },
  };
}

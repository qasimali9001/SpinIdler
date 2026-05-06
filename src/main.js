import { createInitialState } from "./state.js";
import { loadGame, saveGame, hardResetSave } from "./save.js";
import { tick } from "./sim.js";
import { bindUI, renderAll } from "./ui.js";

const SAVE_KEY = "revidle_save_v1";

let state = loadGame(SAVE_KEY, { fallbackState: createInitialState() }) ?? createInitialState();

bindUI({
  getState: () => state,
  setState: (next) => {
    state = next;
  },
  onHardReset: () => {
    hardResetSave(SAVE_KEY);
    state = createInitialState();
  },
});

let last = performance.now();
function frame(now) {
  const dtSec = Math.max(0, Math.min(0.25, (now - last) / 1000));
  last = now;

  state = tick(state, dtSec);
  renderAll(state);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Save loop per brief (every 5 seconds).
setInterval(() => {
  saveGame(SAVE_KEY, state);
}, 5000);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame(SAVE_KEY, state);
});

window.addEventListener("beforeunload", () => {
  saveGame(SAVE_KEY, state);
});


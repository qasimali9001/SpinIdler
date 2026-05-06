import { cloneState, createInitialState } from "./state.js";
import { tick } from "./sim.js";

export function loadGame(key, { fallbackState } = {}) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallbackState ?? null;
    const parsed = JSON.parse(raw);
    const state = migrate(parsed, fallbackState ?? createInitialState());
    return applyOffline(state);
  } catch {
    return fallbackState ?? null;
  }
}

export function saveGame(key, state) {
  try {
    const s = cloneState(state);
    s.meta.lastSavedAtMs = Date.now();
    localStorage.setItem(key, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function hardResetSave(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

function migrate(loaded, base) {
  // Simple schema merge; tighten later if versions diverge.
  const merged = cloneState(base);
  deepAssign(merged, loaded);
  if (!merged.meta) merged.meta = base.meta;
  if (!merged.meta.lastSavedAtMs) merged.meta.lastSavedAtMs = Date.now();
  return merged;
}

function deepAssign(target, src) {
  if (src == null || typeof src !== "object") return;
  for (const [k, v] of Object.entries(src)) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      if (!target[k] || typeof target[k] !== "object") target[k] = {};
      deepAssign(target[k], v);
    } else {
      target[k] = v;
    }
  }
}

function applyOffline(state) {
  const s = cloneState(state);
  const now = Date.now();
  const last = s.meta.lastSavedAtMs ?? now;
  const dtSec = Math.max(0, Math.min(60 * 60 * 12, (now - last) / 1000)); // cap 12h

  // Time Flux accrual: gainPerOfflineSec * offlineSeconds, capped.
  const tf = s.timeFlux;
  const gained = dtSec * (tf.gainPerOfflineSec ?? 0);
  tf.storedSec = Math.min(tf.capSec, (tf.storedSec ?? 0) + gained);

  // Offline production: simulate a capped window so load is fast.
  // Revolution Idle has offline acceleration (time flux); for now we just run the sim normally.
  const maxSimSec = 60 * 60; // 1h of offline sim max
  let remaining = Math.min(dtSec, maxSimSec);
  let simState = s;
  while (remaining > 0) {
    const step = Math.min(1, remaining);
    simState = tick(simState, step);
    remaining -= step;
  }

  s.meta.lastSavedAtMs = now;
  // Preserve the updated state after offline sim.
  simState.meta.lastSavedAtMs = now;
  return simState;
}


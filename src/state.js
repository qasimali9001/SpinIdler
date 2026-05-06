import { createCirclesDefinition } from "./economy.js";

export function createInitialState() {
  const circles = createCirclesDefinition().map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    role: c.role,
    unlocked: c.startUnlocked ?? false,
    level: c.startLevel ?? 0,
    ascensions: 0,
    progress: 0, // [0..1) for lap progress
    multValue: c.role === "multiplier" ? 1 : 0,
  }));

  return {
    version: 1,
    score: 0,
    revolutions: 0,
    rotationProgress: 0, // 0..1 aggregate meter from score
    rotationMultiplier: 1,

    prestige: {
      unlocked: false,
      prestigePoints: 0,
      globalMultiplier: 1,
      exponent: 0, // scaffold
    },

    timeFlux: {
      storedSec: 0,
      capSec: 3600,
      gainPerOfflineSec: 0.1, // 6 minutes per 1 hour ~= 0.1
      spendMultiplier: 1,
      spendEnabled: false,
      upgrades: {
        capLevel: 0,
        gainLevel: 0,
      },
    },

    infinity: {
      points: 0,
      thresholdScore: 1e12, // scaffold threshold (configurable later)
      ready: false,
      upgrades: {
        multBoost: 0,
        tfEfficiency: 0,
        costSoftener: 0,
      },
    },

    circles,

    ui: {
      buyMode: "x1", // x1 | x10 | max
    },

    meta: {
      totalScoreEarned: 0,
      totalPurchases: 0,
      lastSavedAtMs: Date.now(),
    },
  };
}

export function cloneState(state) {
  return structuredClone(state);
}


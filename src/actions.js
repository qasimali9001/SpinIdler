import { cloneState, createInitialState } from "./state.js";
import {
  canAscend,
  getAscendCost,
  getCircleDef,
  getInfinityUpgradeCostIp,
  getInfinityUpgrades,
  getTimeFluxCapForLevel,
  getTimeFluxCapUpgradeCost,
  getTimeFluxGainForLevel,
  getTimeFluxGainUpgradeCost,
  levelCost,
} from "./economy.js";

export function tryBuyLevel(state, circleId) {
  const s = cloneState(state);
  const circle = s.circles.find((c) => c.id === circleId);
  const def = getCircleDef(circleId);
  if (!circle || !def || !circle.unlocked) return state;

  const mode = s.ui?.buyMode ?? "x1";
  const target = mode === "x10" ? 10 : mode === "max" ? 10_000 : 1;

  let bought = 0;
  while (bought < target) {
    const cost = levelCost(def, circle.level);
    if (s.score < cost) break;
    s.score -= cost;
    circle.level += 1;
    s.meta.totalPurchases += 1;
    bought += 1;
  }
  if (bought === 0) return state;

  // Prestige unlock rule per brief: total generator purchases >= 100
  if (!s.prestige.unlocked && s.meta.totalPurchases >= 100) {
    s.prestige.unlocked = true;
  }

  return s;
}

export function prestige(state) {
  if (!state.prestige.unlocked) return state;

  const s = cloneState(state);

  // brief formula: floor(log10(totalScoreEarned + 1))
  const gained = Math.floor(Math.log10((s.meta.totalScoreEarned ?? 0) + 1));
  s.prestige.prestigePoints += gained;
  s.prestige.globalMultiplier = 1 + s.prestige.prestigePoints * 0.1;

  // Reset run state (score, generators, revolutions) per brief.
  const fresh = createInitialState();
  fresh.prestige = s.prestige;
  fresh.infinity = s.infinity;
  fresh.meta.totalScoreEarned = s.meta.totalScoreEarned;
  fresh.meta.totalPurchases = s.meta.totalPurchases;
  fresh.timeFlux = s.timeFlux;

  return fresh;
}

export function tryInfinity(state) {
  if (!state.infinity.ready) return state;
  const s = cloneState(state);

  // Scaffold: grant 1 IP, reset like prestige but keep prestige points.
  s.infinity.points += 1;

  const fresh = createInitialState();
  fresh.prestige = s.prestige;
  fresh.infinity = s.infinity;
  fresh.timeFlux = s.timeFlux;
  fresh.meta.totalScoreEarned = s.meta.totalScoreEarned;
  fresh.meta.totalPurchases = s.meta.totalPurchases;

  return fresh;
}

export function buyInfinityUpgrade(state, upgradeId) {
  const s = cloneState(state);
  const upDef = getInfinityUpgrades().find((u) => u.id === upgradeId);
  if (!upDef) return state;

  const upgrades = s.infinity.upgrades ?? {};
  const curLevel = upgrades[upgradeId] ?? 0;
  if (curLevel >= (upDef.maxLevel ?? Infinity)) return state;

  const costIp = getInfinityUpgradeCostIp(upDef, curLevel);
  if ((s.infinity.points ?? 0) < costIp) return state;

  s.infinity.points -= costIp;
  upgrades[upgradeId] = curLevel + 1;
  s.infinity.upgrades = upgrades;
  return s;
}

export function ascend(state, circleId) {
  const s = cloneState(state);
  const circle = s.circles.find((c) => c.id === circleId);
  const def = getCircleDef(circleId);
  if (!circle || !def) return state;
  if (!canAscend(def, circle)) return state;

  const cost = getAscendCost(def, circle);
  if (s.score < cost) return state;

  s.score -= cost;
  circle.ascensions += 1;
  circle.level = Math.max(5, Math.floor((def.startLevel ?? 1) + 4)); // video: starts at level 5 after ascension
  circle.progress = 0;
  if (def.role === "multiplier") circle.multValue = 1;

  return s;
}

export function toggleTimeFluxSpend(state) {
  const s = cloneState(state);
  s.timeFlux.spendEnabled = !s.timeFlux.spendEnabled;
  return s;
}

export function cycleTimeFluxSpeed(state) {
  const s = cloneState(state);
  const cur = s.timeFlux.spendMultiplier ?? 1;
  const next = cur === 1 ? 5 : cur === 5 ? 10 : 1;
  s.timeFlux.spendMultiplier = next;
  return s;
}

export function upgradeTimeFluxCap(state) {
  const s = cloneState(state);
  const up = s.timeFlux.upgrades ?? { capLevel: 0, gainLevel: 0 };
  const cost = getTimeFluxCapUpgradeCost(up.capLevel);
  if (s.score < cost) return state;
  s.score -= cost;
  up.capLevel += 1;
  s.timeFlux.capSec = getTimeFluxCapForLevel(up.capLevel);
  s.timeFlux.storedSec = Math.min(s.timeFlux.capSec, s.timeFlux.storedSec);
  s.timeFlux.upgrades = up;
  return s;
}

export function upgradeTimeFluxGain(state) {
  const s = cloneState(state);
  const up = s.timeFlux.upgrades ?? { capLevel: 0, gainLevel: 0 };
  const cost = getTimeFluxGainUpgradeCost(up.gainLevel);
  if (s.score < cost) return state;
  s.score -= cost;
  up.gainLevel += 1;
  s.timeFlux.gainPerOfflineSec = getTimeFluxGainForLevel(up.gainLevel);
  s.timeFlux.upgrades = up;
  return s;
}


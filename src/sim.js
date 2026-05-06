import { cloneState } from "./state.js";
import { createCirclesDefinition, getCircleDef, getCoinsPerLap, getLapSpeed, getMultiplierPerLap } from "./economy.js";

export function tick(state, dtSec) {
  const s = cloneState(state);

  // Infinity upgrades (scaffold effects).
  const infUp = s.infinity?.upgrades ?? {};
  const infinityMult = 1 + 0.05 * (infUp.multBoost ?? 0);

  // Time flux spend speeds up simulation.
  const tf = s.timeFlux;
  let simMul = 1;
  if (tf.spendEnabled && tf.storedSec > 0) {
    simMul = tf.spendMultiplier;
    // Time Flux Efficiency reduces drain.
    const drainMul = 1 / (1 + 0.15 * (infUp.tfEfficiency ?? 0));
    tf.storedSec = Math.max(0, tf.storedSec - dtSec * drainMul);
  }
  const dt = dtSec * simMul;

  const runtime = {
    totalMultiplier: 1,
    scorePerSec: 0,
  };

  // Apply global multipliers (prestige + rotation).
  const baseGlobalMult =
    (s.prestige?.globalMultiplier ?? 1) * (s.rotationMultiplier ?? 1) * Math.max(1, infinityMult);

  // First, progress circles, resolve laps.
  let incomePerSec = 0;

  // Chained multipliers: each multiplier circle has its own multValue which multiplies the previous tier.
  // Total income multiplier is the product of all multiplier circles' multValue.
  let chainMult = 1;
  for (const c of s.circles) {
    if (!c.unlocked) continue;
    if ((c.role ?? getCircleDef(c.id)?.role) !== "multiplier") continue;
    chainMult *= Math.max(1, c.multValue ?? 1);
  }

  for (const circle of s.circles) {
    if (!circle.unlocked) continue;
    const def = getCircleDef(circle.id);
    if (!def) continue;
    if (circle.level <= 0) continue;

    const speed = getLapSpeed(def, circle.level, circle.ascensions);
    circle.progress += speed * dt;

    // Resolve completed laps (can be multiple in one tick).
    const completed = Math.floor(circle.progress);
    if (completed > 0) {
      circle.progress -= completed;

      if (def.role === "income") {
        const coinsPerLap = getCoinsPerLap(def, circle.level, circle.ascensions);
        const gained = completed * coinsPerLap * baseGlobalMult * chainMult;
        s.score += gained;
        s.meta.totalScoreEarned += gained;

        // Rotation is driven by the income circle laps (Rev Idle-style).
        // Each full lap increments revolutions by 1 (not +5%).
        s.revolutions += completed;
        s.rotationMultiplier = 1 + s.revolutions;
      } else {
        const mp = getMultiplierPerLap(def, circle.level, circle.ascensions);
        // Each lap increases this circle's multiplier value (chained).
        circle.multValue = Math.max(1, (circle.multValue ?? 1) + completed * mp);
      }
    }

    // For UI stats, estimate per-second contributions.
    if (def.role === "income") {
      const coinsPerLap = getCoinsPerLap(def, circle.level, circle.ascensions);
      incomePerSec += coinsPerLap * speed;
    }
  }

  // Recompute chain multiplier after lap resolution, then softcap.
  chainMult = 1;
  for (const c of s.circles) {
    if (!c.unlocked) continue;
    if ((c.role ?? getCircleDef(c.id)?.role) !== "multiplier") continue;
    c.multValue = softcap(Math.max(1, c.multValue ?? 1), 1e9);
    chainMult *= c.multValue;
  }
  chainMult = softcap(chainMult, 1e12);

  runtime.totalMultiplier = baseGlobalMult * chainMult;
  runtime.scorePerSec = incomePerSec * runtime.totalMultiplier;
  s.runtime = { ...s.runtime, ...runtime, chainMult };

  // Visual rotation progress mirrors the income circle's current lap fill (pie fill).
  const incomeCircle = s.circles.find((c) => (c.role ?? getCircleDef(c.id)?.role) === "income");
  s.rotationProgress = clamp01(incomeCircle?.progress ?? 0);

  // Prestige unlock rule should also be rechecked here in case bulk changes happen later.
  if (!s.prestige.unlocked && s.meta.totalPurchases >= 100) s.prestige.unlocked = true;

  // Infinity scaffold readiness.
  s.infinity.ready = s.score >= s.infinity.thresholdScore;

  // Unlock progression (level 5 unlock next), done in sim to keep deterministic (UI also does it defensively).
  const defs = createCirclesDefinition();
  for (let i = 0; i < s.circles.length - 1; i++) {
    const c = s.circles[i];
    const def = defs[i];
    if (def?.unlocksNextAtLevel && c.level >= def.unlocksNextAtLevel) {
      s.circles[i + 1].unlocked = true;
      if (s.circles[i + 1].level === 0) s.circles[i + 1].level = 1;
    }
  }

  return s;
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

function softcap(x, cap) {
  if (!Number.isFinite(x)) return 1;
  if (x <= cap) return x;
  // Gentle softcap above cap.
  const over = x / cap;
  return cap * (1 + Math.log10(over + 1));
}


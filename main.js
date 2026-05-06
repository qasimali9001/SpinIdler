// Single-file RevIdle (Revolution Idle–style). No ES modules (embedded browser friendly).

(() => {
  const SAVE_KEY = "revidle_save_v2";
  const SAVE_KEY_LEGACY = "revidle_save_v1";
  const INFINITY_THRESHOLD = 1.79e308;
  const PRESTIGE_UNLOCK_SCORE = 1e10;
  /** Extra ^P.Exp per log10(score) step after the first (L−10); tuned so ~1e20 preview P.Mult (delta≈20) lands near ^1.10. */
  const PRESTIGE_EXP_PER_DELTA_AFTER_FIRST = 0.07 / 19;
  const PROD_MULT_SOFTCAP = 1e30;
  const PER_CIRCLE_MULT_SOFTCAP = 1e10;
  const EPS = 1e-6;

  const clamp01 = (x) => (Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0);
  const softcap = (x, cap) => {
    if (!Number.isFinite(x)) return 1;
    if (x <= cap) return x;
    return cap * (1 + Math.log10(x / cap + 1));
  };

  function clampGameScore(x) {
    if (!Number.isFinite(x) || x <= 0) return 0;
    return Math.min(x, INFINITY_THRESHOLD);
  }
  function addMilestoneCapped(prev, inc) {
    const a = clampGameScore(prev);
    if (a >= INFINITY_THRESHOLD) return INFINITY_THRESHOLD;
    const b = !Number.isFinite(inc) || inc < 0 ? 0 : inc;
    const sum = a + Math.min(b, INFINITY_THRESHOLD - a);
    return Number.isFinite(sum) ? sum : INFINITY_THRESHOLD;
  }
  function addScore(state, delta) {
    state.score = addMilestoneCapped(state.score ?? 0, delta);
  }

  function formatNumber(n) {
    if (!Number.isFinite(n)) return "∞";
    const abs = Math.abs(n);
    if (abs >= 1e12) return n.toExponential(2).replace("+", "");
    if (abs < 1000) return n.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0);
    const units = [
      { v: 1e3, s: "K" },
      { v: 1e6, s: "M" },
      { v: 1e9, s: "B" },
      { v: 1e15, s: "Qa" },
      { v: 1e18, s: "Qi" },
    ];
    for (let i = units.length - 1; i >= 0; i--) {
      if (abs >= units[i].v) {
        const val = n / units[i].v;
        return `${val.toFixed(val < 10 ? 2 : val < 100 ? 1 : 0)}${units[i].s}`;
      }
    }
    return n.toExponential(2).replace("+", "");
  }
  function formatMult(x) {
    if (!Number.isFinite(x)) return "×∞";
    if (x < 10_000) return `×${x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0)}`;
    return `×${x.toExponential(2).replace("+", "")}`;
  }
  function formatMultRibbon(x) {
    if (!Number.isFinite(x)) return "∞";
    if (Math.abs(x) >= 1e9) return formatNumber(x);
    if (x >= 1000) return `${Math.floor(x).toLocaleString()} ×`;
    if (x >= 100) return `${x.toFixed(1)} ×`;
    return `${x.toFixed(2)} ×`;
  }

  function prestigeGainFromScore(state, score) {
    const s = Math.max(1, Math.min(score ?? 1, INFINITY_THRESHOLD));
    const curPM = state.prestige?.pMult ?? 1;
    const curPE = state.prestige?.pExponent ?? 1;
    const Lraw = Math.log10(s);
    const L = Number.isFinite(Lraw) ? Math.min(308, Lraw) : 308;
    const delta = Math.max(0, Math.min(299, L - 9));
    const nextPMult = Math.max(curPM, 1 + Math.pow(10, delta));
    const deltaExp = Math.max(0, L - 9);
    const targetPExp =
      1 + 0.03 * Math.min(1, deltaExp) + PRESTIGE_EXP_PER_DELTA_AFTER_FIRST * Math.max(0, deltaExp - 1);
    const nextPExp = Math.max(curPE, Math.min(22, targetPExp));
    return { nextPMult, nextPExp };
  }
  function prestigePreview(state) {
    const s = clampGameScore(Math.max(0, state.score ?? 0));
    if (s < PRESTIGE_UNLOCK_SCORE) {
      return { unlocked: false, nextPMult: state.prestige?.pMult ?? 1, nextPExp: state.prestige?.pExponent ?? 1 };
    }
    const g = prestigeGainFromScore(state, Math.max(1, s));
    return { unlocked: true, nextPMult: g.nextPMult, nextPExp: g.nextPExp };
  }
  function previewPrestigeGain(state) {
    const sc = clampGameScore(state.score ?? 0);
    return prestigeGainFromScore(state, Math.max(1, sc));
  }

  function scoreRevPow(base, exp) {
    const b = Math.max(1e-300, base);
    const e = Math.max(0, exp);
    const lr = Math.log10(b) * e;
    if (!Number.isFinite(lr)) return INFINITY_THRESHOLD;
    if (lr >= 308) return INFINITY_THRESHOLD;
    const v = Math.pow(b, e);
    return Number.isFinite(v) ? Math.min(v, INFINITY_THRESHOLD) : INFINITY_THRESHOLD;
  }

  const ACHIEVEMENTS = [
    { id: "first_score", name: "First rotation", desc: "Earn 100 score.", rewardLabel: "+1% mult gain", reward: { multGain: 0.01 }, check: (s) => s.score >= 100 || (s.meta?.totalScoreEarned ?? 0) >= 100 },
    { id: "unlock_orange", name: "Spectrum", desc: "Unlock Orange.", rewardLabel: "+1% score", reward: { score: 0.01 }, check: (s) => s.circles.some((c) => c.id === "orange" && c.unlocked) },
    { id: "millionaire", name: "Millionaire", desc: "1M total score earned.", rewardLabel: "+5% IP", reward: { ipGain: 0.05 }, check: (s) => (s.meta?.totalScoreEarned ?? 0) >= 1e6 },
    { id: "prestige_ready", name: "Heavy hitter", desc: "Reach 10B total earned.", rewardLabel: "+2% P.Mult", reward: { pMult: 0.02 }, check: (s) => (s.meta?.totalScoreEarned ?? 0) >= PRESTIGE_UNLOCK_SCORE },
    { id: "first_prestige", name: "Promoted", desc: "First prestige.", rewardLabel: "+2% laps", reward: { lapSpeed: 0.02 }, check: (s) => (s.meta?.totalPrestiges ?? 0) >= 1 },
    { id: "ascend_once", name: "Ascendant", desc: "Ascend once.", rewardLabel: "+2% mult gain", reward: { multGain: 0.02 }, check: (s) => s.circles.some((c) => (c.ascensions ?? 0) >= 1) },
    { id: "deep_colors", name: "Deep colors", desc: "Unlock Blue+.", rewardLabel: "−1% cost scaling", reward: { costSoft: 0.01 }, check: (s) => s.circles.some((c) => ["blue", "purple", "pink", "white"].includes(c.id) && c.unlocked) },
    { id: "infinity_ready", name: "Approaching Infinity", desc: "Reach ~1.79e308 highest score.", rewardLabel: "+10% IP", reward: { ipGain: 0.1 }, check: (s) => (s.meta?.highestScore ?? 0) >= INFINITY_THRESHOLD * 0.99 },
    { id: "first_infinity", name: "Infinite", desc: "First Infinity.", rewardLabel: "+5% production", reward: { production: 0.05 }, check: (s) => (s.infinity?.totalInfinities ?? 0) >= 1 },
    { id: "shopaholic", name: "Shopaholic", desc: "250 layer buys.", rewardLabel: "+2% score", reward: { score: 0.02 }, check: (s) => (s.meta?.totalPurchases ?? 0) >= 250 },
  ];

  function aggregateAchievementBonuses(state) {
    const u = state.achievements?.unlocked ?? {};
    const b = { multGain: 0, lapSpeed: 0, score: 0, ipGain: 0, pMult: 0, costSoft: 0, production: 0 };
    for (const a of ACHIEVEMENTS) {
      if (!u[a.id]) continue;
      const r = a.reward ?? {};
      Object.keys(b).forEach((k) => {
        b[k] += r[k] ?? 0;
      });
    }
    return b;
  }
  function processAchievements(state) {
    const u = { ...(state.achievements?.unlocked ?? {}) };
    let changed = false;
    for (const a of ACHIEVEMENTS) {
      if (u[a.id]) continue;
      if (a.check(state)) {
        u[a.id] = true;
        changed = true;
      }
    }
    if (changed) state.achievements = { unlocked: u };
  }

  const PROMO_MILESTONE_MULT_GAIN = [1, 2, 3, 6, 9, 12, 15, 19, 23, 28, 32, 37, 42, 47, 53, 59, 65, 71, 77, 83, 90];
  const PROMO_MILESTONE_LAP_SPEED = [1, 1.5, 1.707, 1.866, 2.0, 2.118, 2.225, 2.323, 2.414, 2.5, 2.581, 2.658, 2.732, 2.803, 2.871, 2.936, 3.0, 3.062, 3.121, 3.179, 3.236];
  const PROMO_MILESTONE_ASC_POWER = [10, 10.5, 10.87, 11.2, 11.52, 11.81, 12.1, 12.37, 12.64, 12.9, 13.15, 13.4, 13.65, 13.89, 14.13, 14.36, 14.59, 14.82, 15.05, 15.27, 15.49];
  const PROMO_MILESTONE_PROMO_POWER = [1, 1.05, 1.07, 1.085, 1.097, 1.108, 1.118, 1.127, 1.136, 1.144, 1.151, 1.158, 1.165, 1.171, 1.177, 1.183, 1.189, 1.195, 1.2, 1.205, 1.211];
  const PROMO_MULT_NEEDED = [0, 1000, 4326, 13390, 36993, 97382, 250680, 638368, 1.62e6, 4.09e6, 1.03e7, 2.60e7, 6.55e7, 1.65e8, 4.16e8, 1.05e9, 2.64e9, 6.66e9, 1.68e10, 4.23e10, 1.07e11];

  function clampPromoLevel(lvl) {
    return Math.max(0, Math.min(20, Math.floor(Number(lvl) || 0)));
  }
  function promoMilestoneExtrapolate(arr, lvl) {
    const L = Math.max(0, Math.floor(lvl));
    if (L <= 20) return arr[clampPromoLevel(L)];
    const n = arr.length - 1;
    const d = arr[n] - arr[n - 1];
    return arr[n] + d * (L - 20);
  }
  function promotionMultipliersFromLevels(levels) {
    const lm = levels.multGain ?? 0;
    const ll = levels.lapSpeed ?? 0;
    const la = levels.ascPower ?? 0;
    const lp = levels.promoPower ?? 0;
    return {
      promoPower: promoMilestoneExtrapolate(PROMO_MILESTONE_PROMO_POWER, lp),
      multGain: promoMilestoneExtrapolate(PROMO_MILESTONE_MULT_GAIN, lm),
      lapSpeed: promoMilestoneExtrapolate(PROMO_MILESTONE_LAP_SPEED, ll),
      ascPower: promoMilestoneExtrapolate(PROMO_MILESTONE_ASC_POWER, la),
    };
  }
  function expFromTotalMult(mult) {
    if (!Number.isFinite(mult) || mult <= 0) return 0;
    const n = PROMO_MULT_NEEDED.length;
    if (mult < PROMO_MULT_NEEDED[1]) return 0;
    const last = PROMO_MULT_NEEDED[n - 1];
    const prev = PROMO_MULT_NEEDED[n - 2];
    if (mult >= last) {
      const logRatio = Math.log(mult / last) / Math.log(last / prev);
      const expAtMax = Math.pow(2, n - 1) - 1;
      const pow = Math.min(logRatio, 900);
      return (expAtMax + 1) * Math.pow(2, pow) - 1;
    }
    for (let L = n - 2; L >= 0; L--) {
      const lo = PROMO_MULT_NEEDED[L];
      const hi = PROMO_MULT_NEEDED[L + 1];
      if (mult >= lo) {
        const frac = (mult - lo) / (hi - lo);
        const expLo = L === 0 ? 0 : Math.pow(2, L) - 1;
        const expHi = Math.pow(2, L + 1) - 1;
        return expLo + frac * (expHi - expLo);
      }
    }
    return 0;
  }
  function maxLevelFromEXP(exp) {
    const e = Math.max(0, exp ?? 0);
    if (e < 1) return 0;
    return Math.floor(Math.log2(e + 1));
  }

  function promotionTotalMultForEXP(state) {
    const ach = aggregateAchievementBonuses(state);
    let prodMult = 1;
    for (const c of state.circles) {
      if (!c.unlocked) continue;
      prodMult *= softcap(Math.max(1, c.multValue ?? 1), PER_CIRCLE_MULT_SOFTCAP);
    }
    prodMult = softcap(prodMult, PROD_MULT_SOFTCAP);
    const pMultBase = state.prestige?.pMult ?? 1;
    const pMult = pMultBase * (1 + ach.pMult);
    const pv = prestigePreview(state);
    const nextPMult = (pv.nextPMult ?? pMult) * (1 + ach.pMult);
    const effectivePMult = Math.max(pMult, nextPMult);
    return prodMult * effectivePMult;
  }
  function promotionTheoreticalExp(state) {
    return expFromTotalMult(promotionTotalMultForEXP(state));
  }

  function circlesDef() {
    return [
      { id: "red", name: "Red", color: "var(--red)", order: 0, startUnlocked: true, startLevel: 5, baseCost: 4, baseCostMult: 1.2, baseLapSpeedPerLevel: 0.2, unlocksNextAtLevel: 5 },
      { id: "orange", name: "Orange", color: "var(--orange)", order: 1, baseCost: 100, baseCostMult: 1.24, baseLapSpeedPerLevel: 0.1, unlocksNextAtLevel: 5 },
      { id: "yellow", name: "Yellow", color: "var(--yellow)", order: 2, baseCost: 1_000, baseCostMult: 1.28, baseLapSpeedPerLevel: 0.067, unlocksNextAtLevel: 5 },
      { id: "green", name: "Green", color: "var(--green)", order: 3, baseCost: 10_000, baseCostMult: 1.32, baseLapSpeedPerLevel: 0.05, unlocksNextAtLevel: 5 },
      { id: "turquoise", name: "Turquoise", color: "var(--turquoise)", order: 4, baseCost: 1_000_000, baseCostMult: 1.36, baseLapSpeedPerLevel: 0.04, unlocksNextAtLevel: 5 },
      { id: "cyan", name: "Cyan", color: "var(--cyan)", order: 5, baseCost: 1e9, baseCostMult: 1.4, baseLapSpeedPerLevel: 0.033, unlocksNextAtLevel: 5 },
      { id: "blue", name: "Blue", color: "var(--blue)", order: 6, baseCost: 1e12, baseCostMult: 1.44, baseLapSpeedPerLevel: 0.029, unlocksNextAtLevel: 5 },
      { id: "purple", name: "Purple", color: "var(--purple)", order: 7, baseCost: 1e15, baseCostMult: 1.48, baseLapSpeedPerLevel: 0.025, unlocksNextAtLevel: 5 },
      { id: "pink", name: "Pink", color: "var(--pink)", order: 8, baseCost: 1e18, baseCostMult: 1.52, baseLapSpeedPerLevel: 0.022, unlocksNextAtLevel: 5 },
      { id: "white", name: "White", color: "var(--white)", order: 9, baseCost: 1e27, baseCostMult: 1.56, baseLapSpeedPerLevel: 0.02, unlocksNextAtLevel: null },
    ];
  }
  function getDef(id) {
    return circlesDef().find((c) => c.id === id) ?? null;
  }
  function costMultiplierAtAsc(def, ascensions) {
    return def.baseCostMult + 0.1 * Math.max(0, ascensions ?? 0);
  }
  function baseFactorForAscensions(def, ascensions) {
    let factor = 1;
    let cap = 100;
    for (let a = 0; a < Math.max(0, ascensions ?? 0); a++) {
      factor *= Math.pow(costMultiplierAtAsc(def, a), cap);
      cap += 10;
    }
    return factor;
  }
  function levelCost(def, level, ascensions, costSoftener = 0) {
    const a = Math.max(0, ascensions ?? 0);
    const cm = Math.max(1.02, costMultiplierAtAsc(def, a) - 0.002 * costSoftener);
    return def.baseCost * baseFactorForAscensions(def, a) * Math.pow(cm, Math.max(0, level));
  }
  function lapSpeed(def, level) {
    return def.baseLapSpeedPerLevel * Math.max(0, level);
  }
  function scorePerLap() {
    return 1;
  }
  function promotionPromoPowerMult(state) {
    return promotionMultipliersFromLevels(state.promote?.levels ?? {}).promoPower;
  }
  function promotionMultGainMult(state) {
    return promotionMultipliersFromLevels(state.promote?.levels ?? {}).multGain;
  }
  function promotionLapSpeedMult(state) {
    return promotionMultipliersFromLevels(state.promote?.levels ?? {}).lapSpeed;
  }
  function ascPower(state) {
    return promotionMultipliersFromLevels(state.promote?.levels ?? {}).ascPower;
  }
  function multGainPerLap(state, circle) {
    const base = 0.01;
    const a = Math.max(0, circle.ascensions ?? 0);
    const ap = Math.max(1, ascPower(state));
    const series = ap === 1 ? a + 1 : (Math.pow(ap, a + 1) - 1) / (ap - 1);
    return base * series * promotionMultGainMult(state);
  }
  function levelCap(circle) {
    return 100 + 10 * Math.max(0, circle.ascensions ?? 0);
  }
  function canAscend(_def, circle) {
    return circle.unlocked && circle.level >= levelCap(circle);
  }
  function ascendCost(def, circle, costSoftener = 0) {
    const tierBase = Math.max(1, def.baseCost);
    const a = Math.max(0, circle.ascensions ?? 0);
    return tierBase * 50_000 * Math.pow(35, a) * Math.max(0.85, 1 - 0.002 * costSoftener);
  }

  function getInfinityUpgrades() {
    return [
      { id: "multBoost", name: "Infinity Mult", desc: "+5% score / rev (mult).", baseCostIp: 1, costScale: 2, maxLevel: 50 },
      { id: "costSoftener", name: "Cost softener", desc: "Slightly cheaper layer levels.", baseCostIp: 2, costScale: 2.35, maxLevel: 30 },
      { id: "ipBoost", name: "Richer Infinities", desc: "+20% IP (future scaling).", baseCostIp: 3, costScale: 2.5, maxLevel: 25 },
      { id: "lapSpeed", name: "Faster laps", desc: "+4% laps/sec.", baseCostIp: 2, costScale: 2.2, maxLevel: 40 },
      { id: "multGain", name: "Sharper mult gain", desc: "+4% mult gain / lap.", baseCostIp: 4, costScale: 2.45, maxLevel: 40 },
    ];
  }
  function infCost(def, lvl) {
    return Math.floor(def.baseCostIp * Math.pow(def.costScale, Math.max(0, lvl)));
  }
  function infinityProgress01(score) {
    if (!Number.isFinite(score) || score <= 0) return 0;
    if (score >= INFINITY_THRESHOLD * 0.999999) return 1;
    const num = Math.log10(score + 1);
    const den = Math.log10(INFINITY_THRESHOLD);
    return Number.isFinite(num) && den > 0 ? clamp01(num / den) : 0;
  }
  function ipGainOnInfinity() {
    return 1;
  }

  function initialState() {
    const circles = circlesDef().map((c) => ({
      id: c.id,
      name: c.name,
      color: c.color,
      unlocked: c.startUnlocked ?? false,
      level: c.startLevel ?? 0,
      ascensions: 0,
      progress: 0,
      multValue: 1,
    }));
    return {
      version: 2,
      score: 0,
      revolutions: 0,
      rotationProgress: 0,
      rotationMultiplier: 1,
      prestige: { unlocked: false, pMult: 1, pExponent: 1 },
      promote: { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } },
      infinity: {
        points: 0,
        totalInfinities: 0,
        thresholdScore: INFINITY_THRESHOLD,
        ready: false,
        upgrades: { multBoost: 0, costSoftener: 0, ipBoost: 0, lapSpeed: 0, multGain: 0 },
      },
      achievements: { unlocked: {} },
      circles,
      ui: { buyMode: "x1", activePanel: "revolution" },
      meta: { totalScoreEarned: 0, totalPurchases: 0, totalPrestiges: 0, highestScore: 0, runHighScore: 0, lastSavedAtMs: Date.now() },
      runtime: { totalMultiplier: 1, scorePerSec: 0, effectiveScorePerRev: 1, effectivePMult: 1, promoteUnlocked: false, promoExpBalance: 0 },
      dev: { speedMul: 1 },
    };
  }

  function deepAssign(target, src) {
    if (src == null || typeof src !== "object") return;
    for (const [k, v] of Object.entries(src)) {
      if (v && typeof v === "object" && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== "object") target[k] = {};
        deepAssign(target[k], v);
      } else target[k] = v;
    }
  }
  function migrate(loaded) {
    const base = initialState();
    deepAssign(base, loaded);
    base.version = 2;
    if (!base.promote) base.promote = { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } };
    if (base.promote.expRef == null || !Number.isFinite(base.promote.expRef)) base.promote.expRef = 0;
    delete base.promote.expEarned;
    delete base.promote.exp;
    delete base.timeFlux;
    if (!base.infinity.upgrades) base.infinity.upgrades = {};
    const u = base.infinity.upgrades;
    base.infinity.upgrades = {
      multBoost: u.multBoost ?? 0,
      costSoftener: u.costSoftener ?? 0,
      ipBoost: u.ipBoost ?? 0,
      lapSpeed: u.lapSpeed ?? 0,
      multGain: u.multGain ?? 0,
    };
    if (base.infinity.totalInfinities == null) base.infinity.totalInfinities = 0;
    base.infinity.thresholdScore = INFINITY_THRESHOLD;
    if (!base.meta.totalPrestiges) base.meta.totalPrestiges = 0;
    if (base.meta.highestScore == null) base.meta.highestScore = 0;
    if (base.meta.runHighScore == null) base.meta.runHighScore = 0;
    if (!base.dev) base.dev = { speedMul: 1 };
    if (base.dev.speedMul !== 1 && base.dev.speedMul !== 10) base.dev.speedMul = 1;
    base.score = clampGameScore(base.score ?? 0);
    base.meta.totalScoreEarned = clampGameScore(base.meta.totalScoreEarned ?? 0);
    base.meta.highestScore = clampGameScore(base.meta.highestScore ?? 0);
    return base;
  }

  function save(state) {
    try {
      state.meta.lastSavedAtMs = Date.now();
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      try {
        localStorage.removeItem(SAVE_KEY_LEGACY);
      } catch {
        /* */
      }
    } catch {
      /* */
    }
  }
  function load() {
    try {
      let raw = localStorage.getItem(SAVE_KEY);
      if (!raw) raw = localStorage.getItem(SAVE_KEY_LEGACY);
      if (!raw) return initialState();
      return applyOffline(migrate(JSON.parse(raw)));
    } catch {
      return initialState();
    }
  }
  function applyOffline(state) {
    const now = Date.now();
    const last = state.meta.lastSavedAtMs ?? now;
    const dtSec = Math.max(0, Math.min(12 * 3600, (now - last) / 1000));
    let rem = Math.min(dtSec, 3600);
    const dev = state.dev?.speedMul === 10 ? 10 : 1;
    while (rem > 0) {
      const step = Math.min(1, rem);
      tick(state, step * dev);
      rem -= step;
    }
    state.meta.lastSavedAtMs = now;
    return state;
  }

  function drawConcentric(canvasEl, circles) {
    const ctx = canvasEl.getContext("2d");
    const W = canvasEl.width;
    const H = canvasEl.height;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2;
    const cy = H / 2;
    const visible = circles.filter((c) => c.unlocked);
    visible.sort((a, b) => (getDef(a.id)?.order ?? 999) - (getDef(b.id)?.order ?? 999));
    const maxRings = circlesDef().length;
    const edgePad = 10;
    const maxR = Math.min(W, H) / 2 - edgePad;
    const slotSize = maxR / maxRings;
    const strokeW = Math.max(6, Math.floor(slotSize * 0.74));
    const angle0 = -Math.PI / 2;
    const tau = Math.PI * 2;

    // Dark background circle
    ctx.beginPath();
    ctx.arc(cx, cy, maxR + edgePad * 0.5, 0, tau);
    ctx.fillStyle = "rgba(8,10,16,0.75)";
    ctx.fill();

    // Outer decorative ring
    ctx.beginPath();
    ctx.arc(cx, cy, maxR + 2, 0, tau);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    ctx.stroke();

    for (const c of visible) {
      const def = getDef(c.id);
      if (!def) continue;
      const i = def.order ?? 0;
      const r = slotSize * (i + 0.5);
      const p = clamp01(c.progress ?? 0);
      const cssVar = def.color.replace("var(", "").replace(")", "");
      const color = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || "#3bb7ff";

      if (i === 0) {
        // Red: filled pie
        const fillR = r + strokeW * 0.48;
        // Background fill
        ctx.beginPath();
        ctx.arc(cx, cy, fillR, 0, tau);
        ctx.fillStyle = "rgba(255,59,59,0.10)";
        ctx.fill();
        // Progress pie
        if (p > 0) {
          const end = angle0 + p * tau;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.arc(cx, cy, fillR, angle0, end, false);
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.88;
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        // Border ring
        ctx.beginPath();
        ctx.arc(cx, cy, fillR, 0, tau);
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      } else {
        // Outer rings: donut arcs
        // Track (dim background arc)
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, tau);
        ctx.strokeStyle = "rgba(255,255,255,0.07)";
        ctx.lineWidth = strokeW;
        ctx.lineCap = "butt";
        ctx.shadowBlur = 0;
        ctx.stroke();

        if (p <= 0) continue;

        // Glow pass
        ctx.beginPath();
        if (p >= 0.999) ctx.arc(cx, cy, r, 0, tau);
        else ctx.arc(cx, cy, r, angle0, angle0 + p * tau, false);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeW + 6;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 18;
        ctx.globalAlpha = 0.35;
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        // Main arc
        ctx.beginPath();
        if (p >= 0.999) ctx.arc(cx, cy, r, 0, tau);
        else ctx.arc(cx, cy, r, angle0, angle0 + p * tau, false);
        ctx.strokeStyle = color;
        ctx.lineWidth = strokeW;
        ctx.lineCap = "round";
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }
  }

  function tick(state, dtSec) {
    const infUp = state.infinity?.upgrades ?? {};
    const ach = aggregateAchievementBonuses(state);
    const costSoftener = (infUp.costSoftener ?? 0) + (ach.costSoft ?? 0) * 100;
    const devMul = state.dev?.speedMul === 10 ? 10 : 1;
    const dt = dtSec * devMul;

    const defs = circlesDef();
    for (let i = 0; i < state.circles.length - 1; i++) {
      const c = state.circles[i];
      const d = defs[i];
      if (d?.unlocksNextAtLevel && c.level >= d.unlocksNextAtLevel) state.circles[i + 1].unlocked = true;
    }

    let prodMult = 1;
    for (const c of state.circles) {
      if (!c.unlocked) continue;
      prodMult *= Math.max(1, c.multValue ?? 1);
    }
    prodMult = softcap(prodMult, PROD_MULT_SOFTCAP);

    const pMultBase = state.prestige?.pMult ?? 1;
    const pMult = pMultBase * (1 + ach.pMult);
    const pExp = state.prestige?.pExponent ?? 1;
    const pv = prestigePreview(state);
    const nextPMult = (pv.nextPMult ?? pMult) * (1 + ach.pMult);
    const effectivePMult = Math.max(pMult, nextPMult);
    state.runtime.effectivePMult = effectivePMult;
    state.runtime.promoteUnlocked = effectivePMult >= 1000;

    const infinityMult = 1 + 0.05 * (infUp.multBoost ?? 0);
    const lapSpeedInf = 1 + 0.04 * (infUp.lapSpeed ?? 0);
    const lapSpeedAch = 1 + ach.lapSpeed;
    const multGainInf = 1 + 0.04 * (infUp.multGain ?? 0);
    const multGainAch = 1 + ach.multGain;
    const productionAch = 1 + ach.production;
    const scoreAch = 1 + ach.score;

    let scorePerRev = scoreRevPow(prodMult * pMult, pExp) * infinityMult * productionAch * scoreAch;
    if (!Number.isFinite(scorePerRev) || scorePerRev > INFINITY_THRESHOLD) scorePerRev = INFINITY_THRESHOLD;

    let lapsPerSec = 0;
    for (const circle of state.circles) {
      if (!circle.unlocked || circle.level <= 0) continue;
      const def = getDef(circle.id);
      if (!def) continue;
      const spd = lapSpeed(def, circle.level) * promotionLapSpeedMult(state) * lapSpeedInf * lapSpeedAch;
      lapsPerSec += spd;
      circle.progress += spd * dt;
      const completed = Math.floor(circle.progress);
      if (completed > 0) {
        circle.progress -= completed;
        const gainedRaw = completed * scorePerLap() * scorePerRev;
        const gained = Number.isFinite(gainedRaw) ? Math.min(gainedRaw, INFINITY_THRESHOLD) : INFINITY_THRESHOLD;
        addScore(state, gained);
        state.meta.totalScoreEarned = addMilestoneCapped(state.meta.totalScoreEarned ?? 0, gained);
        state.revolutions += completed;
        const mg = multGainPerLap(state, circle) * multGainInf * multGainAch;
        circle.multValue = Math.max(1, (circle.multValue ?? 1) + completed * mg);
      }
    }

    prodMult = 1;
    for (const c of state.circles) {
      if (!c.unlocked) continue;
      c.multValue = softcap(Math.max(1, c.multValue ?? 1), PER_CIRCLE_MULT_SOFTCAP);
      prodMult *= c.multValue;
    }
    prodMult = softcap(prodMult, PROD_MULT_SOFTCAP);
    state.rotationMultiplier = prodMult;
    state.rotationProgress = clamp01(state.circles.find((c) => c.id === "red")?.progress ?? 0);

    const totalMultCore = prodMult * pMult;
    let effectiveScorePerRev = scoreRevPow(totalMultCore, pExp) * infinityMult * productionAch * scoreAch;
    if (!Number.isFinite(effectiveScorePerRev) || effectiveScorePerRev > INFINITY_THRESHOLD) effectiveScorePerRev = INFINITY_THRESHOLD;
    state.runtime.totalMultiplier = totalMultCore;
    let sps = lapsPerSec * effectiveScorePerRev;
    if (!Number.isFinite(sps) || sps > INFINITY_THRESHOLD) sps = INFINITY_THRESHOLD;
    state.runtime.scorePerSec = sps;
    state.runtime.effectiveScorePerRev = effectiveScorePerRev;

    state.promote = state.promote ?? { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } };
    const theoretical = expFromTotalMult(prodMult * effectivePMult);
    let expRef = Number(state.promote.expRef) || 0;
    if (theoretical < expRef) expRef = theoretical;
    state.promote.expRef = expRef;
    state.runtime.promoExpBalance = Math.max(0, theoretical - expRef);

    if (state.score > (state.meta.highestScore ?? 0)) state.meta.highestScore = clampGameScore(state.score);
    if (!state.prestige.unlocked && state.score >= PRESTIGE_UNLOCK_SCORE) state.prestige.unlocked = true;
    state.score = clampGameScore(state.score ?? 0);
    state.infinity.ready = state.score >= INFINITY_THRESHOLD;

    processAchievements(state);
    if (state.infinity.ready) doInfinity();

    state._costSoftener = costSoftener;
  }

  function setActivePanel(panel) {
    state.ui = state.ui ?? {};
    state.ui.activePanel = panel;
    const map = {
      revolution: document.getElementById("panel-revolution"),
      infinity: document.getElementById("panel-infinity"),
      achievements: document.getElementById("panel-achievements"),
      stats: document.getElementById("panel-stats"),
    };
    for (const [k, el] of Object.entries(map)) {
      if (!el) continue;
      el.hidden = k !== panel;
    }
    document.querySelectorAll(".navRail__btn[data-panel]").forEach((b) => {
      b.classList.toggle("navRail__btn--active", b.getAttribute("data-panel") === panel);
    });
  }

  function renderMultRibbon(state) {
    const strip = document.getElementById("mult-strip");
    if (!strip) return;
    strip.innerHTML = "";
    const frag = document.createDocumentFragment();
    const ach = aggregateAchievementBonuses(state);
    const pMultOn = (state.prestige?.pMult ?? 1) * (1 + ach.pMult);
    let first = true;
    for (const c of state.circles) {
      if (!c.unlocked) continue;
      if (!first) {
        const sep = document.createElement("span");
        sep.className = "multSep";
        sep.textContent = "×";
        frag.appendChild(sep);
      }
      first = false;
      const def = getDef(c.id);
      const cssVar = def.color.replace("var(", "").replace(")", "");
      const col = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
      const sp = document.createElement("span");
      sp.className = "multVal";
      sp.style.color = col;
      sp.textContent = formatMultRibbon(c.multValue ?? 1);
      frag.appendChild(sp);
    }
    const sep = document.createElement("span");
    sep.className = "multSep";
    sep.textContent = "×";
    frag.appendChild(sep);
    const psp = document.createElement("span");
    psp.className = "multVal";
    psp.style.color = "rgba(210,220,240,0.9)";
    psp.textContent = formatMultRibbon(pMultOn);
    frag.appendChild(psp);
    strip.appendChild(frag);
  }

  function renderLayers(state) {
    const list = document.getElementById("generators-list");
    if (!list) return;
    list.innerHTML = "";
    const costSoft = state._costSoftener ?? 0;
    const infUp = state.infinity?.upgrades ?? {};
    const lapSpeedInf = 1 + 0.04 * (infUp.lapSpeed ?? 0);
    const ach = aggregateAchievementBonuses(state);
    const lapSpeedAch = 1 + ach.lapSpeed;
    const lapMult = promotionLapSpeedMult(state) * lapSpeedInf * lapSpeedAch;
    for (const circle of state.circles) {
      if (!circle.unlocked) continue;
      const def = getDef(circle.id);
      const cap = levelCap(circle);
      const cost = levelCost(def, circle.level, circle.ascensions ?? 0, costSoft);
      const spd = lapSpeed(def, circle.level) * lapMult;
      const spdNext = lapSpeed(def, Math.min(cap, circle.level + 1)) * lapMult;
      const delta = spdNext - spd;
      const canBuy = circle.level < cap && state.score + EPS >= cost;
      const isMaxed = circle.level >= cap;
      const canAsc = canAscend(def, circle);
      const aCost = canAsc ? ascendCost(def, circle, costSoft) : 0;
      const canAscNow = canAsc && state.score + EPS >= aCost;
      const cssVar = def.color.replace("var(", "").replace(")", "");
      const col = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || "#aaa";
      const multDisplay = formatMultRibbon(circle.multValue ?? 1);
      const wrap = document.createElement("div");
      wrap.className = `circRow${isMaxed ? " circRow--maxed" : ""}`;
      wrap.style.cssText = `background:linear-gradient(135deg,${col}52 0%,${col}28 100%);border:1px solid ${col}5a`;
      wrap.innerHTML = `
        <button type="button" class="circRow__asc" data-asc="${circle.id}"
          ${canAscNow ? "" : "disabled"}
          title="${canAsc ? `Ascend (${formatNumber(aCost)})` : "Not at cap yet"}">A</button>
        <button type="button" class="circRow__buy" data-buy="${circle.id}" ${canBuy ? "" : "disabled"}>
          <div class="circRow__top">
            <span class="circRow__laps">Laps/s: ${spd.toFixed(2)} <span class="circRow__delta">(+${delta.toFixed(2)})</span></span>
            <span class="circRow__mult" style="color:${col}">${multDisplay}</span>
          </div>
          <div class="circRow__bot">
            <span class="circRow__cost">${formatNumber(cost)}</span>
            <span class="circRow__lv">${isMaxed ? "Max Level" : `Lv ${circle.level} / ${cap}`}</span>
          </div>
        </button>`;
      list.appendChild(wrap);
    }
  }

  function renderAchievementsList(state) {
    const root = document.getElementById("achievements-list");
    if (!root) return;
    root.innerHTML = "";
    const u = state.achievements?.unlocked ?? {};
    for (const a of ACHIEVEMENTS) {
      const ok = !!u[a.id];
      const row = document.createElement("div");
      row.className = `achRow${ok ? "" : " achRow--locked"}`;
      row.innerHTML = `<div><div class="achRow__title">${a.name}</div><div class="achRow__desc">${a.desc}</div><div class="achRow__desc"><strong>${a.rewardLabel}</strong></div></div><div class="achRow__badge">${ok ? "DONE" : "LOCKED"}</div>`;
      root.appendChild(row);
    }
  }

  function renderInfinityUpgrades(state) {
    const root = document.getElementById("infinity-upgrades");
    if (!root) return;
    root.innerHTML = "";
    const levels = state.infinity.upgrades ?? {};
    for (const u of getInfinityUpgrades()) {
      const lvl = levels[u.id] ?? 0;
      const cost = infCost(u, lvl);
      const canBuy = (state.infinity.points ?? 0) >= cost && lvl < (u.maxLevel ?? Infinity);
      const row = document.createElement("div");
      row.className = "kv__row";
      row.style.flexDirection = "column";
      row.style.alignItems = "stretch";
      row.innerHTML = `<div class="kv__k"><strong>${u.name}</strong> <span class="muted">Lv ${lvl}</span><div class="muted">${u.desc}</div></div>
        <button type="button" class="btn btn--tiny ${canBuy ? "btn--primary" : ""}" data-inf="${u.id}" ${canBuy ? "" : "disabled"}>Buy (${cost} IP)</button>`;
      row.querySelector(`[data-inf]`).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        buyInf(u.id);
      });
      root.appendChild(row);
    }
  }

  function render(state) {
    const panel = state.ui?.activePanel ?? "revolution";
    setActivePanel(panel);
    renderMultRibbon(state);
    renderLayers(state);
    renderAchievementsList(state);
    renderInfinityUpgrades(state);

    document.getElementById("score-value").textContent = formatNumber(clampGameScore(state.score ?? 0));
    const devMul = state.dev?.speedMul === 10 ? 10 : 1;
    const infUp = state.infinity?.upgrades ?? {};
    const ach = aggregateAchievementBonuses(state);
    const pMult = (state.prestige?.pMult ?? 1) * (1 + ach.pMult);
    const pExp = state.prestige?.pExponent ?? 1;
    const infinityMult = 1 + 0.05 * (infUp.multBoost ?? 0);
    const multGainInf = 1 + 0.04 * (infUp.multGain ?? 0);
    const multGainAch = 1 + ach.multGain;
    const productionAch = 1 + ach.production;
    const scoreAch = 1 + ach.score;
    let prodMult = 1;
    for (const c of state.circles) {
      if (!c.unlocked) continue;
      prodMult *= softcap(Math.max(1, c.multValue ?? 1), PER_CIRCLE_MULT_SOFTCAP);
    }
    prodMult = softcap(prodMult, PROD_MULT_SOFTCAP);
    let scorePerRev = scoreRevPow(prodMult * pMult, pExp) * infinityMult * productionAch * scoreAch;
    if (!Number.isFinite(scorePerRev) || scorePerRev > INFINITY_THRESHOLD) scorePerRev = INFINITY_THRESHOLD;
    let laps = 0;
    const lapSpeedInf = 1 + 0.04 * (infUp.lapSpeed ?? 0);
    const lapSpeedAch = 1 + ach.lapSpeed;
    for (const circle of state.circles) {
      if (!circle.unlocked || circle.level <= 0) continue;
      const def = getDef(circle.id);
      if (!def) continue;
      laps += lapSpeed(def, circle.level) * promotionLapSpeedMult(state) * lapSpeedInf * lapSpeedAch;
    }
    const perRev = document.getElementById("per-rev-gain");
    const perSec = document.getElementById("per-rev-rate");
    if (perRev) perRev.textContent = `+${formatNumber(scorePerRev)} / rev`;
    if (perSec) perSec.textContent = `+${formatNumber(laps * scorePerRev * devMul)} / sec`;

    const pct = infinityProgress01(state.score) * 100;
    const fill = document.getElementById("infinity-progress-fill");
    const pctEl = document.getElementById("infinity-progress-pct");
    if (fill) fill.style.width = `${Math.min(100, pct)}%`;
    if (pctEl) pctEl.textContent = `${pct.toFixed(2)}%`;

    const curPM = state.prestige.pMult ?? 1;
    const curPE = state.prestige.pExponent ?? 1;
    const { nextPMult, nextPExp } = previewPrestigeGain(state);
    const expLine = document.getElementById("prestige-exp-line");
    const multLine = document.getElementById("prestige-mult-line");
    const hint = document.getElementById("prestige-hint");
    if (expLine) expLine.textContent = `^${curPE.toFixed(2)} → ^${nextPExp.toFixed(2)}`;
    if (multLine) multLine.textContent = `${formatMult(curPM)} → ${formatMult(nextPMult)}`;
    if (hint) hint.textContent = state.prestige.unlocked ? "Prestige resets this run (circles & score) and applies previewed P row." : `Reach ${formatNumber(PRESTIGE_UNLOCK_SCORE)} score to unlock.`;

    document.getElementById("btn-prestige").disabled = !state.prestige.unlocked;
    const btnProm = document.getElementById("btn-promote");
    if (btnProm) btnProm.disabled = !state.runtime.promoteUnlocked;

    document.getElementById("stat-revolutions").textContent = String(state.revolutions);
    const devBtn = document.getElementById("btn-dev-speed");
    if (devBtn) {
      devBtn.textContent = state.dev?.speedMul === 10 ? "Dev ×10" : "Dev ×1";
      devBtn.classList.toggle("btn--primary", state.dev?.speedMul === 10);
    }
    document.getElementById("stat-ip").textContent = String(state.infinity.points ?? 0);
    const infDone = document.getElementById("stat-infinities");
    if (infDone) infDone.textContent = String(state.infinity.totalInfinities ?? 0);
    document.getElementById("stat-infinity-ready").textContent = state.infinity.ready ? "Yes" : "No";
    document.getElementById("btn-infinity").disabled = !state.infinity.ready;

    document.getElementById("stat-total-earned").textContent = formatNumber(state.meta.totalScoreEarned ?? 0);
    document.getElementById("stat-total-purchases").textContent = String(state.meta.totalPurchases ?? 0);
    const tp = document.getElementById("stat-total-prestiges");
    if (tp) tp.textContent = String(state.meta.totalPrestiges ?? 0);
    document.getElementById("stat-global-mult").textContent = formatMult(state.prestige.pMult);
    const pexp = document.getElementById("stat-p-exp");
    if (pexp) pexp.textContent = `^${(state.prestige.pExponent ?? 1).toFixed(2)}`;
    document.getElementById("stat-total-mult").textContent = formatMult(state.runtime.totalMultiplier ?? 1);
    document.getElementById("stat-score-per-sec").textContent = formatNumber(state.runtime.scorePerSec ?? 0);

    drawConcentric(document.getElementById("rotation-canvas"), state.circles);

    ["x1", "x10", "max"].forEach((m) => {
      const el = document.getElementById(`buy-${m}`);
      if (el) el.classList.toggle("btn--primary", (state.ui?.buyMode ?? "x1") === m);
    });
  }

  let state = load();

  function tryBuy(circleId) {
    const def = getDef(circleId);
    const circle = state.circles.find((c) => c.id === circleId);
    if (!circle || !def) return;
    const cap = levelCap(circle);
    if (circle.level >= cap) return;
    const mode = state.ui?.buyMode ?? "x1";
    const target = mode === "x10" ? 10 : mode === "max" ? 10000 : 1;
    const costSoft = state._costSoftener ?? 0;
    let bought = 0;
    while (bought < target) {
      if (circle.level >= cap) break;
      const cost = levelCost(def, circle.level, circle.ascensions ?? 0, costSoft);
      if (state.score + EPS < cost) break;
      state.score -= cost;
      circle.level += 1;
      state.meta.totalPurchases += 1;
      bought++;
    }
    if (!state.prestige.unlocked && state.score >= PRESTIGE_UNLOCK_SCORE) state.prestige.unlocked = true;
  }

  function tryBuyMaxAllLayers() {
    for (let s = 0; s < 80; s++) {
      let any = false;
      for (const circle of state.circles) {
        if (!circle.unlocked) continue;
        const def = getDef(circle.id);
        const cap = levelCap(circle);
        if (circle.level >= cap) continue;
        const costSoft = state._costSoftener ?? 0;
        const cost = levelCost(def, circle.level, circle.ascensions ?? 0, costSoft);
        if (state.score + EPS < cost) continue;
        const before = circle.level;
        tryBuy(circle.id);
        if (circle.level !== before) any = true;
      }
      if (!any) break;
    }
  }

  function doAscend(circleId) {
    const def = getDef(circleId);
    const circle = state.circles.find((c) => c.id === circleId);
    if (!circle || !def) return;
    if (!canAscend(def, circle)) return;
    const costSoft = state._costSoftener ?? 0;
    const cost = ascendCost(def, circle, costSoft);
    if (state.score + EPS < cost) return;
    state.score -= cost;
    circle.ascensions += 1;
    circle.level = 5;
    circle.progress = 0;
  }

  function ascendAllAvailable() {
    for (let r = 0; r < 30; r++) {
      let any = false;
      for (const circle of state.circles) {
        if (!circle.unlocked) continue;
        const def = getDef(circle.id);
        if (!def || !canAscend(def, circle)) continue;
        const costSoft = state._costSoftener ?? 0;
        if (state.score + EPS < ascendCost(def, circle, costSoft)) continue;
        const before = circle.ascensions;
        doAscend(circle.id);
        if (circle.ascensions !== before) any = true;
      }
      if (!any) break;
    }
  }

  function doPrestige() {
    if (!state.prestige.unlocked) return;
    const sc = Math.max(1, clampGameScore(state.score ?? 0));
    const { nextPMult, nextPExp } = prestigeGainFromScore(state, sc);
    state.prestige.pMult = nextPMult;
    state.prestige.pExponent = nextPExp;
    state.meta.totalPrestiges = (state.meta.totalPrestiges ?? 0) + 1;
    const keep = { prestige: state.prestige, promote: state.promote, infinity: state.infinity, achievements: state.achievements, meta: state.meta, dev: state.dev };
    state = initialState();
    state.prestige = keep.prestige;
    state.promote = keep.promote;
    state.infinity = keep.infinity;
    state.achievements = keep.achievements;
    state.dev = keep.dev ?? { speedMul: 1 };
    state.meta.totalScoreEarned = keep.meta.totalScoreEarned;
    state.meta.totalPurchases = keep.meta.totalPurchases;
    state.meta.totalPrestiges = keep.meta.totalPrestiges;
    state.meta.highestScore = keep.meta.highestScore;
    state.meta.runHighScore = 0;
  }

  function doPromote(which) {
    if (!state.runtime.promoteUnlocked) return;
    state.promote = state.promote ?? { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } };
    const theoretical = promotionTheoreticalExp(state);
    let expRef = Number(state.promote.expRef) || 0;
    if (theoretical < expRef) expRef = theoretical;
    const balance = Math.max(0, theoretical - expRef);
    const maxLvl = maxLevelFromEXP(balance);
    const cur = state.promote.levels[which] ?? 0;
    if (maxLvl <= cur) return;
    const newLevels = { ...state.promote.levels, [which]: maxLvl };
    const keep = { newLevels, infinity: state.infinity, achievements: state.achievements, meta: state.meta, dev: state.dev };
    state = initialState();
    state.promote = { expRef: promotionTheoreticalExp(state), levels: keep.newLevels };
    state.infinity = keep.infinity;
    state.achievements = keep.achievements;
    state.dev = keep.dev ?? { speedMul: 1 };
    state.meta.totalScoreEarned = keep.meta.totalScoreEarned;
    state.meta.totalPurchases = keep.meta.totalPurchases;
    state.meta.totalPrestiges = keep.meta.totalPrestiges;
    state.meta.highestScore = keep.meta.highestScore;
    state.meta.runHighScore = 0;
    hidePromoteModal();
  }

  function doInfinity() {
    if (!state.infinity.ready) return;
    const ip = ipGainOnInfinity();
    state.infinity.points = (state.infinity.points ?? 0) + ip;
    state.infinity.totalInfinities = (state.infinity.totalInfinities ?? 0) + 1;
    state.infinity.ready = false;
    const keepInf = { ...state.infinity };
    const keepAch = state.achievements;
    const keepMeta = state.meta;
    const keepDev = state.dev;
    state = initialState();
    state.infinity = keepInf;
    state.achievements = keepAch;
    state.promote = { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } };
    state.dev = keepDev ?? { speedMul: 1 };
    state.meta.totalScoreEarned = keepMeta.totalScoreEarned;
    state.meta.totalPurchases = keepMeta.totalPurchases;
    state.meta.totalPrestiges = keepMeta.totalPrestiges;
    state.meta.highestScore = keepMeta.highestScore;
    state.meta.runHighScore = 0;
    processAchievements(state);
  }

  function buyInf(upgradeId) {
    const u = getInfinityUpgrades().find((x) => x.id === upgradeId);
    if (!u) return;
    const upgrades = { ...(state.infinity.upgrades ?? {}) };
    const lvl = upgrades[upgradeId] ?? 0;
    if (lvl >= (u.maxLevel ?? Infinity)) return;
    const cost = infCost(u, lvl);
    if ((state.infinity.points ?? 0) < cost) return;
    state.infinity.points -= cost;
    upgrades[upgradeId] = lvl + 1;
    state.infinity.upgrades = upgrades;
  }

  function showPromoteModal() {
    if (!state.runtime.promoteUnlocked) return;
    const modal = document.getElementById("promote-modal");
    if (!modal) return;
    modal.hidden = false;
    renderPromoteOptions();
  }
  function hidePromoteModal() {
    const m = document.getElementById("promote-modal");
    if (m) m.hidden = true;
  }
  function renderPromoteOptions() {
    const body = document.getElementById("promote-options");
    if (!body) return;
    const p = state.promote ?? { expRef: 0, levels: { multGain: 0, lapSpeed: 0, ascPower: 0, promoPower: 0 } };
    const theoretical = promotionTheoreticalExp(state);
    const expRef = Number(p.expRef) || 0;
    const balance = Math.max(0, theoretical - expRef);
    const maxLvl = maxLevelFromEXP(balance);
    const effPM = state.runtime?.effectivePMult ?? 1;
    const expForNext = Math.pow(2, maxLvl + 1) - 1;
    const expNeeded = Math.max(0, expForNext - balance);
    const opts = [
      { id: "multGain", name: "#1 Mult gain", desc: "Mult gain per lap." },
      { id: "lapSpeed", name: "#2 Lap speed", desc: "Laps per second." },
      { id: "ascPower", name: "#3 Ascension power", desc: "Ascension scaling." },
      { id: "promoPower", name: "#4 Promotion power", desc: "Boosts the other three." },
    ];
    body.innerHTML = "";
    const header = document.createElement("div");
    header.className = "promoOption promoOption--header";
    header.innerHTML = `<div class="promoOption__top"><div class="promoOption__name">Promotion EXP</div></div>
      <div class="promoOption__meta"><span>EXP <strong>${formatNumber(balance)}</strong></span><span>·</span><span>Max Lv <strong>${maxLvl}</strong></span><span>·</span><span>P.Mult (eff.) <strong>${formatMult(effPM)}</strong></span><span>·</span><span>Next Lv need <strong>${formatNumber(expNeeded)}</strong></span></div>
      <div class="muted">Spend all current EXP on one track; EXP bar resets until mult grows again.</div>`;
    body.appendChild(header);
    const grid = document.createElement("div");
    grid.className = "promoGrid";
    body.appendChild(grid);
    for (const o of opts) {
      const lvl = p.levels?.[o.id] ?? 0;
      const can = maxLvl > lvl;
      const curM = promotionMultipliersFromLevels(p.levels);
      const nextL = { ...p.levels, [o.id]: maxLvl };
      const nextM = promotionMultipliersFromLevels(nextL);
      const curVal = o.id === "promoPower" ? curM.promoPower : curM[o.id];
      const nextVal = o.id === "promoPower" ? nextM.promoPower : nextM[o.id];
      const fmt = (id, v) => (id === "ascPower" ? `AP ${v.toFixed(2)}` : `×${v.toFixed(3)}`);
      const card = document.createElement("div");
      card.className = "promoOption";
      card.innerHTML = `<div class="promoOption__name">${o.name} <span class="muted">Lv ${lvl}</span></div><div class="promoOption__meta"><span>${o.desc}</span><span>Now <strong>${fmt(o.id, curVal)}</strong></span>${can ? `<span>Next <strong>${fmt(o.id, nextVal)}</strong></span>` : ""}</div>
        <button type="button" class="btn btn--tiny ${can ? "btn--primary" : "btn--ghost"}" data-promo="${o.id}" ${can ? "" : "disabled"}>${can ? `Promote [${lvl}→${maxLvl}]` : "Max for EXP"}</button>`;
      card.querySelector(`[data-promo]`).addEventListener("pointerdown", (e) => {
        e.preventDefault();
        doPromote(o.id);
      });
      grid.appendChild(card);
    }
  }

  function hardReset() {
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(SAVE_KEY_LEGACY);
    } catch {
      /* */
    }
    state = initialState();
  }
  function toggleDevSpeed() {
    state.dev = state.dev ?? { speedMul: 1 };
    state.dev.speedMul = state.dev.speedMul === 10 ? 1 : 10;
  }

  function wireGeneratorsList() {
    const list = document.getElementById("generators-list");
    if (!list || list._bound) return;
    list._bound = true;
    list.addEventListener("pointerdown", (e) => {
      const b = e.target.closest("[data-buy]");
      const a = e.target.closest("[data-asc]");
      if (b) {
        e.preventDefault();
        tryBuy(b.getAttribute("data-buy"));
      } else if (a) {
        e.preventDefault();
        doAscend(a.getAttribute("data-asc"));
      }
    });
  }

  document.getElementById("btn-hard-reset").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    hardReset();
  });
  document.getElementById("btn-prestige").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    doPrestige();
  });
  document.getElementById("btn-infinity").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    doInfinity();
  });
  document.getElementById("btn-layer-max")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    tryBuyMaxAllLayers();
  });
  document.getElementById("btn-ascend-all")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    ascendAllAvailable();
  });
  document.getElementById("btn-promote")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    showPromoteModal();
  });
  document.getElementById("btn-promote-close")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    hidePromoteModal();
  });
  document.getElementById("promote-modal")?.addEventListener("pointerdown", (e) => {
    if (e.target.id === "promote-modal") hidePromoteModal();
  });
  document.getElementById("btn-dev-speed")?.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    toggleDevSpeed();
  });
  document.querySelectorAll(".navRail__btn[data-panel]").forEach((b) => {
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const p = b.getAttribute("data-panel");
      if (p && !b.disabled) setActivePanel(p);
    });
  });
  const setBuyMode = (mode) => {
    state.ui = state.ui ?? {};
    state.ui.buyMode = mode;
  };
  document.getElementById("buy-x1").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setBuyMode("x1");
  });
  document.getElementById("buy-x10").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setBuyMode("x10");
  });
  document.getElementById("buy-max").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setBuyMode("max");
  });

  wireGeneratorsList();

  let last = performance.now();
  function frame(now) {
    const dt = Math.max(0, Math.min(0.25, (now - last) / 1000));
    last = now;
    tick(state, dt);
    render(state);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setInterval(() => save(state), 5000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save(state);
  });
  window.addEventListener("beforeunload", () => save(state));
})();

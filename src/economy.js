export function createCirclesDefinition() {
  // Phase 1: approximate Revolution Idle early colors.
  // We keep 5 tiers per brief, but allow extending later.
  return [
    {
      id: "red",
      name: "Red Circle",
      color: "var(--red)",
      startUnlocked: true,
      startLevel: 1,
      role: "income",
      baseCost: 10,
      costScaling: 1.15,
      baseLapSpeed: 0.85, // faster early feel (Rev Idle-style)
      lapSpeedPerLevel: 0.22,
      baseCoinsPerLap: 12,
      coinsPerLapPerLevel: 5.5,
      baseMultiplierPerLap: 0,
      multiplierPerLapPerLevel: 0,
      unlocksNextAtLevel: 5,
    },
    {
      id: "orange",
      name: "Orange Circle",
      color: "var(--orange)",
      role: "multiplier",
      baseCost: 100,
      costScaling: 1.15,
      baseLapSpeed: 0.06,
      lapSpeedPerLevel: 0.02,
      baseCoinsPerLap: 0,
      coinsPerLapPerLevel: 0,
      baseMultiplierPerLap: 0.02,
      multiplierPerLapPerLevel: 0.01,
      unlocksNextAtLevel: 5,
    },
    {
      id: "yellow",
      name: "Yellow Circle",
      color: "var(--yellow)",
      role: "multiplier",
      baseCost: 2_000,
      costScaling: 1.15,
      baseLapSpeed: 0.03,
      lapSpeedPerLevel: 0.011,
      baseCoinsPerLap: 0,
      coinsPerLapPerLevel: 0,
      baseMultiplierPerLap: 0.03,
      multiplierPerLapPerLevel: 0.012,
      unlocksNextAtLevel: 5,
    },
    {
      id: "green",
      name: "Green Circle",
      color: "var(--green)",
      role: "multiplier",
      baseCost: 40_000,
      costScaling: 1.15,
      baseLapSpeed: 0.017,
      lapSpeedPerLevel: 0.008,
      baseCoinsPerLap: 0,
      coinsPerLapPerLevel: 0,
      baseMultiplierPerLap: 0.05,
      multiplierPerLapPerLevel: 0.015,
      unlocksNextAtLevel: 5,
    },
    {
      id: "blue",
      name: "Blue Circle",
      color: "var(--blue)",
      role: "multiplier",
      baseCost: 800_000,
      costScaling: 1.15,
      baseLapSpeed: 0.012,
      lapSpeedPerLevel: 0.006,
      baseCoinsPerLap: 0,
      coinsPerLapPerLevel: 0,
      baseMultiplierPerLap: 0.07,
      multiplierPerLapPerLevel: 0.02,
      unlocksNextAtLevel: null,
    },
  ];
}

export function getCircleDef(circleId) {
  return createCirclesDefinition().find((c) => c.id === circleId) ?? null;
}

export function levelCost(def, level) {
  // cost for purchasing the next level from current `level`
  // brief says cost = baseCost * 1.15^owned; we interpret "owned" as "level-1"
  const owned = Math.max(0, level - 1);
  return def.baseCost * Math.pow(def.costScaling, owned);
}

export function getLapSpeed(def, level, ascensions) {
  const base = def.baseLapSpeed + def.lapSpeedPerLevel * Math.max(0, level - 1);
  const ascPow = getAscensionPower(ascensions);
  return base * ascPow;
}

export function getAscensionPower(ascensions) {
  // Simple exponential power scaling; tuned later.
  return Math.pow(1.75, Math.max(0, ascensions));
}

export function getCoinsPerLap(def, level, ascensions) {
  if (def.role !== "income") return 0;
  const base = def.baseCoinsPerLap + def.coinsPerLapPerLevel * Math.max(0, level - 1);
  const ascPow = getAscensionPower(ascensions);
  return base * ascPow;
}

export function getMultiplierPerLap(def, level, ascensions) {
  if (def.role !== "multiplier") return 0;
  const base = def.baseMultiplierPerLap + def.multiplierPerLapPerLevel * Math.max(0, level - 1);
  const ascPow = getAscensionPower(ascensions);
  return base * ascPow;
}

export function canAscend(def, circle) {
  if (!def || !circle) return false;
  const neededLevel = def.ascendAtLevel ?? 25;
  return circle.unlocked && circle.level >= neededLevel;
}

export function getAscendCost(def, circle) {
  // Ascension is a major power spike; cost ramps fast.
  // Tuned later; for now based on next-level cost times a large factor.
  const base = levelCost(def, circle.level) * 250;
  const a = Math.max(0, circle.ascensions ?? 0);
  return base * Math.pow(6, a);
}

export function getTimeFluxCapForLevel(capLevel) {
  // 1h, 2h, 4h, 8h...
  return 3600 * Math.pow(2, Math.max(0, capLevel));
}

export function getTimeFluxGainForLevel(gainLevel) {
  // Starts at 0.1 (6m per 1h). Each level +0.05, softcapped later.
  return 0.1 + 0.05 * Math.max(0, gainLevel);
}

export function getTimeFluxCapUpgradeCost(capLevel) {
  // Uses score as currency for now.
  return 1_000_000 * Math.pow(10, Math.max(0, capLevel));
}

export function getTimeFluxGainUpgradeCost(gainLevel) {
  return 2_500_000 * Math.pow(12, Math.max(0, gainLevel));
}

export function getInfinityUpgrades() {
  return [
    {
      id: "multBoost",
      name: "Infinity Mult",
      desc: "Boost total multiplier (multiplicative).",
      baseCostIp: 1,
      costScale: 2,
      maxLevel: 50,
    },
    {
      id: "tfEfficiency",
      name: "Time Flux Efficiency",
      desc: "Time Flux drains slower while active.",
      baseCostIp: 2,
      costScale: 2.4,
      maxLevel: 25,
    },
    {
      id: "costSoftener",
      name: "Cost Softener",
      desc: "Slightly reduces upgrade scaling.",
      baseCostIp: 3,
      costScale: 2.7,
      maxLevel: 25,
    },
  ];
}

export function getInfinityUpgradeCostIp(upgradeDef, level) {
  return Math.floor(upgradeDef.baseCostIp * Math.pow(upgradeDef.costScale, Math.max(0, level)));
}


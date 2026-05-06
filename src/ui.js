import {
  canAscend,
  getAscendCost,
  getCircleDef,
  getInfinityUpgradeCostIp,
  getInfinityUpgrades,
  levelCost,
  getLapSpeed,
  getCoinsPerLap,
} from "./economy.js";
import { formatMult, formatNumber, formatTimeSec } from "./format.js";
import { drawRotation } from "./canvas.js";
import {
  ascend,
  buyInfinityUpgrade,
  cycleTimeFluxSpeed,
  prestige,
  toggleTimeFluxSpend,
  tryInfinity,
  tryBuyLevel,
  upgradeTimeFluxCap,
  upgradeTimeFluxGain,
} from "./actions.js";

let _api = null;

export function bindUI(api) {
  _api = api;

  document.getElementById("btn-hard-reset").addEventListener("click", () => {
    api.onHardReset();
  });

  document.getElementById("btn-prestige").addEventListener("click", () => {
    const s = api.getState();
    api.setState(prestige(s));
  });

  document.getElementById("btn-infinity").addEventListener("click", () => {
    const s = api.getState();
    api.setState(tryInfinity(s));
  });

  document.querySelectorAll(".tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      if (!tab) return;
      setActiveTab(tab);
    });
  });

  const setBuyMode = (mode) => {
    const s = api.getState();
    const next = structuredClone(s);
    next.ui = next.ui ?? {};
    next.ui.buyMode = mode;
    api.setState(next);
    syncBuyModeButtons(next);
  };

  document.getElementById("buy-x1").addEventListener("click", () => setBuyMode("x1"));
  document.getElementById("buy-x10").addEventListener("click", () => setBuyMode("x10"));
  document.getElementById("buy-max").addEventListener("click", () => setBuyMode("max"));

  document.getElementById("btn-tf-toggle").addEventListener("click", () => {
    api.setState(toggleTimeFluxSpend(api.getState()));
  });
  document.getElementById("btn-tf-speed").addEventListener("click", () => {
    api.setState(cycleTimeFluxSpeed(api.getState()));
  });
  document.getElementById("btn-tf-up-cap").addEventListener("click", () => {
    api.setState(upgradeTimeFluxCap(api.getState()));
  });
  document.getElementById("btn-tf-up-gain").addEventListener("click", () => {
    api.setState(upgradeTimeFluxGain(api.getState()));
  });
}

function setActiveTab(tab) {
  document.querySelectorAll(".tab").forEach((b) => {
    b.classList.toggle("tab--active", b.getAttribute("data-tab") === tab);
  });
  document.querySelectorAll(".tabpane").forEach((p) => {
    p.classList.toggle("tabpane--active", p.getAttribute("data-tabpane") === tab);
  });
}

export function renderAll(state) {
  syncBuyModeButtons(state);
  renderTopbar(state);
  renderCenter(state);
  renderGenerators(state);
  renderRight(state);
}

function syncBuyModeButtons(state) {
  const mode = state.ui?.buyMode ?? "x1";
  const map = {
    x1: document.getElementById("buy-x1"),
    x10: document.getElementById("buy-x10"),
    max: document.getElementById("buy-max"),
  };
  for (const [k, el] of Object.entries(map)) {
    if (!el) continue;
    el.classList.toggle("btn--primary", k === mode);
  }
}

function renderTopbar(state) {
  const score = state.score;
  const scorePerSec = state.runtime?.scorePerSec ?? 0;
  const totalMult = state.runtime?.totalMultiplier ?? 1;

  document.getElementById("stat-score").textContent = formatNumber(score);
  document.getElementById("stat-score-per-sec").textContent = formatNumber(scorePerSec);
  document.getElementById("stat-total-mult").textContent = formatMult(totalMult);
  document.getElementById("stat-revolutions").textContent = String(state.revolutions);

  const prestigeText = state.prestige.unlocked
    ? `${state.prestige.prestigePoints} PP (${formatMult(state.prestige.globalMultiplier)})`
    : "Locked";
  document.getElementById("stat-prestige").textContent = prestigeText;

  document.getElementById("stat-time-flux").textContent = `${formatTimeSec(state.timeFlux.storedSec)}/${formatTimeSec(
    state.timeFlux.capSec,
  )}`;
}

function renderCenter(state) {
  document.getElementById("score-value").textContent = formatNumber(state.score);
  document.getElementById("rotation-progress").textContent = `${Math.floor(state.rotationProgress * 100)}%`;
  document.getElementById("rotation-mult").textContent = formatMult(state.rotationMultiplier);

  const canvas = document.getElementById("rotation-canvas");
  drawRotation(canvas, {
    progress01: state.rotationProgress,
    ringColor: "rgba(255,255,255,0.15)",
    fillColor: "rgba(59,183,255,0.75)",
    labelTop: "Rotation",
    labelBottom: formatMult(state.rotationMultiplier),
  });

  const btnPrestige = document.getElementById("btn-prestige");
  btnPrestige.disabled = !state.prestige.unlocked;
}

function renderGenerators(state) {
  const list = document.getElementById("generators-list");

  list.innerHTML = "";
  state.circles.forEach((circle) => {
    if (!circle.unlocked) return;
    const def = getCircleDef(circle.id);
    if (!def) return;

    const cost = levelCost(def, circle.level);
    const speed = getLapSpeed(def, circle.level, circle.ascensions);
    const coinsPerLap = getCoinsPerLap(def, circle.level, circle.ascensions);
    const coinsPerSec = coinsPerLap * speed * (state.runtime?.totalMultiplier ?? 1);
    const canAsc = canAscend(def, circle);
    const ascCost = canAsc ? getAscendCost(def, circle) : 0;

    const card = document.createElement("div");
    card.className = "gen";
    card.style.borderColor = "rgba(255,255,255,0.08)";

    card.innerHTML = `
      <div class="gen__header">
        <div class="gen__name" style="color: ${def.color}">${circle.name}</div>
        <div class="gen__pill">Lv ${circle.level}</div>
      </div>
      <div class="gen__rows">
        <div class="gen__row"><span>Laps/sec</span><strong>${speed.toFixed(2)}</strong></div>
        <div class="gen__row"><span>Cost</span><strong>${formatNumber(cost)}</strong></div>
        <div class="gen__row"><span>Income</span><strong>${def.role === "income" ? `${formatNumber(coinsPerSec)}/s` : "Multiplier"}</strong></div>
        <div class="gen__row"><span>Asc</span><strong>${circle.ascensions}</strong></div>
      </div>
      <div class="gen__actions">
        <button class="btn" data-buy="${circle.id}" ${state.score >= cost ? "" : "disabled"}>Upgrade</button>
        <button class="btn btn--ghost" data-asc="${circle.id}" ${canAsc ? "" : "disabled"} title="Ascend at level ${def.ascendAtLevel ?? 25}">
          Ascend${canAsc ? ` (${formatNumber(ascCost)})` : ""}
        </button>
      </div>
    `;

    card.querySelector(`[data-buy="${circle.id}"]`).addEventListener("click", () => {
      const s = _api.getState();
      _api.setState(tryBuyLevel(s, circle.id));
    });

    card.querySelector(`[data-asc="${circle.id}"]`).addEventListener("click", () => {
      const s = _api.getState();
      _api.setState(ascend(s, circle.id));
    });

    list.appendChild(card);
  });
}

function renderRight(state) {
  document.getElementById("stat-total-earned").textContent = formatNumber(state.meta.totalScoreEarned);
  document.getElementById("stat-total-purchases").textContent = String(state.meta.totalPurchases);
  document.getElementById("stat-global-mult").textContent = formatMult(state.prestige.globalMultiplier);

  document.getElementById("tf-stored").textContent = `${formatTimeSec(state.timeFlux.storedSec)}/${formatTimeSec(
    state.timeFlux.capSec,
  )}`;
  document.getElementById("tf-spend").textContent = state.timeFlux.spendEnabled ? "On" : "Off";
  document.getElementById("tf-speed").textContent = `x${state.timeFlux.spendMultiplier ?? 1}`;

  document.getElementById("stat-ip").textContent = String(state.infinity.points);
  document.getElementById("stat-infinity-ready").textContent = state.infinity.ready ? "Yes" : "No";
  document.getElementById("btn-infinity").disabled = !state.infinity.ready;

  renderInfinityUpgrades(state);
}

function renderInfinityUpgrades(state) {
  const root = document.getElementById("infinity-upgrades");
  if (!root) return;
  const defs = getInfinityUpgrades();
  const levels = state.infinity.upgrades ?? {};
  root.innerHTML = "";

  for (const u of defs) {
    const lvl = levels[u.id] ?? 0;
    const cost = getInfinityUpgradeCostIp(u, lvl);
    const canBuy = (state.infinity.points ?? 0) >= cost && lvl < (u.maxLevel ?? Infinity);

    const row = document.createElement("div");
    row.className = "kv__row";
    row.innerHTML = `
      <div class="kv__k">
        <div style="font-weight:800;color:rgba(231,237,246,0.92)">${u.name} <span style="color:rgba(142,163,189,1)">Lv ${lvl}</span></div>
        <div class="muted">${u.desc}</div>
      </div>
      <div class="kv__v">
        <button class="btn ${canBuy ? "btn--primary" : ""}" data-inf-buy="${u.id}" ${canBuy ? "" : "disabled"}>
          Buy (${cost} IP)
        </button>
      </div>
    `;
    row.querySelector(`[data-inf-buy="${u.id}"]`).addEventListener("click", () => {
      _api.setState(buyInfinityUpgrade(_api.getState(), u.id));
    });
    root.appendChild(row);
  }
}


export function formatNumber(n) {
  if (!Number.isFinite(n)) return "∞";
  const abs = Math.abs(n);
  if (abs < 1000) return n.toFixed(abs < 10 ? 2 : abs < 100 ? 1 : 0);

  const units = [
    { v: 1e3, s: "K" },
    { v: 1e6, s: "M" },
    { v: 1e9, s: "B" },
    { v: 1e12, s: "T" },
    { v: 1e15, s: "Qa" },
    { v: 1e18, s: "Qi" },
  ];

  for (let i = units.length - 1; i >= 0; i--) {
    if (abs >= units[i].v) {
      const val = n / units[i].v;
      return `${val.toFixed(val < 10 ? 2 : val < 100 ? 1 : 0)}${units[i].s}`;
    }
  }

  // Fallback to scientific.
  return n.toExponential(2).replace("+", "");
}

export function formatMult(x) {
  if (!Number.isFinite(x)) return "x∞";
  if (x < 10_000) return `x${x.toFixed(x < 10 ? 2 : x < 100 ? 1 : 0)}`;
  return `x${x.toExponential(2).replace("+", "")}`;
}

export function formatTimeSec(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}


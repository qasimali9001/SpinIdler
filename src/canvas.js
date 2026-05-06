export function drawRotation(canvasEl, { progress01, ringColor, fillColor, labelTop, labelBottom }) {
  if (!canvasEl) return;
  const ctx = canvasEl.getContext("2d");
  if (!ctx) return;

  const w = canvasEl.width;
  const h = canvasEl.height;
  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.40;
  const thickness = Math.max(10, Math.floor(Math.min(w, h) * 0.05));

  ctx.clearRect(0, 0, w, h);

  const start = -Math.PI / 2;
  const end = start + Math.PI * 2 * clamp01(progress01);

  // Pie background (full disk, subtle)
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Pie fill (Rev Idle-like wedge)
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, start, end, false);
  ctx.closePath();
  ctx.fill();

  // Outline ring
  ctx.lineWidth = thickness;
  ctx.strokeStyle = ringColor;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  // Inner glow
  const grad = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 1.2);
  grad.addColorStop(0, "rgba(59,183,255,0.12)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = "rgba(231,237,246,0.92)";
  ctx.textAlign = "center";

  ctx.font = "700 14px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial";
  ctx.fillText(labelTop ?? "", cx, cy - 10);
  ctx.font = "900 20px ui-sans-serif, system-ui, Segoe UI, Roboto, Arial";
  ctx.fillText(labelBottom ?? "", cx, cy + 18);
}

function clamp01(x) {
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}


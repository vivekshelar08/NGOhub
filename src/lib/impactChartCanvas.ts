/** Client-side canvas chart rendering for PDF/Word export (no extra deps). */

export interface ChartSlice {
  name: string;
  value: number;
}

const COLORS = ["#10b981", "#6366f1", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"];

function setupCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

export function renderBarChartImage(
  data: ChartSlice[],
  options: { title: string; width?: number; height?: number; color?: string }
): string {
  const width = options.width ?? 520;
  const height = options.height ?? 280;
  const canvas = setupCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length === 0) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText(options.title, 16, 24);

  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const chartTop = 44;
  const chartBottom = height - 36;
  const chartHeight = chartBottom - chartTop;
  const barWidth = Math.min(48, (width - 80) / data.length - 8);
  const gap = 12;
  const startX = 40;

  data.forEach((item, i) => {
    const barH = (item.value / maxVal) * chartHeight;
    const x = startX + i * (barWidth + gap);
    const y = chartBottom - barH;

    ctx.fillStyle = options.color ?? COLORS[i % COLORS.length];
    ctx.fillRect(x, y, barWidth, barH);

    ctx.fillStyle = "#475569";
    ctx.font = "10px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(item.value), x + barWidth / 2, y - 4);

    const label = item.name.length > 10 ? `${item.name.slice(0, 9)}…` : item.name;
    ctx.fillText(label, x + barWidth / 2, chartBottom + 14);
  });

  return canvas.toDataURL("image/png");
}

export function renderPieChartImage(
  data: ChartSlice[],
  options: { title: string; width?: number; height?: number }
): string {
  const width = options.width ?? 520;
  const height = options.height ?? 280;
  const canvas = setupCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx || data.length === 0) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText(options.title, 16, 24);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = width * 0.32;
  const cy = height * 0.55;
  const radius = Math.min(width, height) * 0.28;
  let angle = -Math.PI / 2;

  data.forEach((item, i) => {
    const slice = (item.value / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + slice);
    ctx.closePath();
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fill();
    angle += slice;
  });

  const legendX = width * 0.58;
  let legendY = 50;
  data.forEach((item, i) => {
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = "#334155";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`${item.name}: ${item.value}`, legendX + 18, legendY + 10);
    legendY += 20;
  });

  return canvas.toDataURL("image/png");
}

export function renderProgressChartImage(
  items: { label: string; pct: number | null; achieved: number; target: number }[],
  options: { title: string; width?: number; height?: number }
): string {
  const width = options.width ?? 520;
  const height = options.height ?? 160 + items.length * 48;
  const canvas = setupCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillText(options.title, 16, 24);

  items.forEach((item, i) => {
    const y = 48 + i * 48;
    const pct = item.pct ?? 0;
    const barW = width - 80;

    ctx.fillStyle = "#334155";
    ctx.font = "11px system-ui, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(
      `${item.label}: ${item.achieved.toLocaleString("en-IN")} / ${item.target.toLocaleString("en-IN")} (${item.pct ?? "—"}%)`,
      24,
      y
    );

    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(24, y + 8, barW, 16);
    ctx.fillStyle = COLORS[i % COLORS.length];
    ctx.fillRect(24, y + 8, (barW * Math.min(100, pct)) / 100, 16);
  });

  return canvas.toDataURL("image/png");
}

export function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

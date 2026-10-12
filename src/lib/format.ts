/** Small display helpers shared by pages. All output is plain text. */

const numberFormat = new Intl.NumberFormat("en-US");

export function formatNumber(n: number): string {
  return numberFormat.format(n);
}

/** 1,284 / 12.9K / 4.2M */
export function compactNumber(n: number): string {
  if (Math.abs(n) < 10_000) return formatNumber(n);
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function percent(part: number, whole: number): string {
  if (whole <= 0) return "–";
  return `${Math.round((part / whole) * 100)}%`;
}

export function ratio(a: number, b: number): string {
  if (b === 0) return a === 0 ? "–" : a.toFixed(2);
  return (a / b).toFixed(2);
}

export function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "±0";
}

/** 4:05, or 1:02:03 */
export function duration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

export function formatDate(ms: number): string {
  return dateFormat.format(ms);
}

export function formatDateTime(ms: number): string {
  return `${dateTimeFormat.format(ms)} UTC`;
}

/** "3 minutes ago", "2 years ago" */
export function timeAgo(ms: number, now = Date.now()): string {
  const diff = Math.round((ms - now) / 1000);
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000],
    ["month", 2_592_000],
    ["week", 604_800],
    ["day", 86_400],
    ["hour", 3600],
    ["minute", 60],
  ];
  const rtf = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return "just now";
}

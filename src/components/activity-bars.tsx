import { formatDate, formatNumber } from "@/lib/format";

/**
 * Fights per week as columns. Server-rendered; each column shows its exact count on hover or
 * keyboard focus, and the numbers are also in a visually hidden table for screen readers.
 */
export function ActivityBars({ weeks, height = 120 }: { weeks: { start: number; fights: number }[]; height?: number }) {
  const max = Math.max(1, ...weeks.map((d) => d.fights));
  const top = niceCeil(max);
  return (
    <figure className="w-full">
      <div className="relative" style={{ height }}>
        {/* gridlines: 0, half (when it's a whole number), top */}
        {[0, 0.5, 1].filter((f) => Number.isInteger(top * f)).map((f) => (
          <div key={f} className="absolute left-0 right-0 border-t border-line" style={{ bottom: f * height }}>
            <span className="num absolute -top-2.5 right-full mr-2 text-xs text-faint">{formatNumber(Math.round(top * f))}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex items-end gap-[2px]">
          {weeks.map((d) => (
            <div key={d.start} className="group relative flex h-full flex-1 items-end justify-center" tabIndex={0}>
              <div
                className="w-full max-w-6 rounded-t bg-accent/80 group-hover:bg-accent group-focus:bg-accent"
                style={{ height: d.fights === 0 ? 0 : Math.max(2, (d.fights / top) * height) }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lg group-hover:block group-focus:block">
                <span className="num font-semibold text-text">{formatNumber(d.fights)}</span>{" "}
                <span className="text-muted">fights, week of {formatDate(d.start)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 flex justify-between text-xs text-faint">
        <span>{formatDate(weeks[0]?.start ?? 0)}</span>
        <span>Week of {formatDate(weeks[weeks.length - 1]?.start ?? 0)}</span>
      </div>
      <table className="sr-only">
        <caption>Fights per week</caption>
        <tbody>
          {weeks.map((d) => (
            <tr key={d.start}>
              <th>Week of {formatDate(d.start)}</th>
              <td>{d.fights}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function niceCeil(n: number): number {
  const pow = 10 ** Math.floor(Math.log10(n));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (step * pow >= n) return step * pow;
  }
  return 10 * pow;
}

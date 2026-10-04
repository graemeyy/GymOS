import { formatAud } from "@/lib/money";

// A ranked list with proportional bars: readable on a phone, no chart library,
// and the numbers are real text (accessible and copyable).
export function BarList({ rows, money = true, empty }: { rows: { name: string; value: number }[]; money?: boolean; empty: string }) {
  if (rows.length === 0) return <p className="px-4 py-3 text-sm text-ink-soft">{empty}</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className="space-y-3 px-4 py-4">
      {rows.map((r) => (
        <li key={r.name}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate">{r.name}</span>
            <span className="tabular font-medium">{money ? formatAud(r.value) : r.value}</span>
          </div>
          <div aria-hidden="true" className="mt-1 h-2 rounded-sm bg-sunken">
            <div className="h-2 rounded-sm bg-plate" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Seven small columns for daily counts.
export function DayColumns({ days }: { days: { date: string; count: number }[] }) {
  const max = Math.max(...days.map((d) => d.count), 1);
  const label = new Intl.DateTimeFormat("en-AU", { weekday: "short", timeZone: "UTC" });
  return (
    <div className="px-4 py-4">
      <ol className="flex h-28 items-end gap-2" aria-label="Check-ins per day, last 7 days">
        {days.map((d) => (
          <li key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="tabular text-xs font-medium">{d.count}</span>
            <span aria-hidden="true" className="w-full rounded-sm bg-plate" style={{ height: `${Math.max(4, (d.count / max) * 80)}px` }} />
            <span className="text-xs text-ink-soft">{label.format(new Date(`${d.date}T00:00:00Z`))}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

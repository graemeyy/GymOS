import { zonedTimeToUtc } from "@/lib/dates";

export interface Period {
  key: string;
  label: string;
  from: Date;
  to: Date;
}

function partsIn(date: Date, tz: string) {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(date).split("-").map(Number);
  return { y, m };
}

const iso = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}-01`;
const monthStart = (y: number, m: number, tz: string) => zonedTimeToUtc(iso(y + Math.floor((m - 1) / 12), ((m - 1 + 1200) % 12) + 1), "00:00", tz);
const monthName = (m: number) => new Intl.DateTimeFormat("en-AU", { month: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2020, m - 1, 1)));

// Australian reporting periods in the gym's timezone. BAS quarters run
// Jul–Sep, Oct–Dec, Jan–Mar and Apr–Jun; the financial year starts 1 July.
export function standardPeriods(tz: string, now = new Date()): Period[] {
  const { y, m } = partsIn(now, tz);
  const quarterStartMonth = [7, 10, 1, 4].find((start) => {
    const months = [start, start + 1, start + 2].map((x) => ((x - 1) % 12) + 1);
    return months.includes(m);
  })!;
  const qYear = quarterStartMonth > m ? y - 1 : y;
  const fyStartYear = m >= 7 ? y : y - 1;
  return [
    { key: "this-month", label: `${monthName(m)} ${y}`, from: monthStart(y, m, tz), to: monthStart(y, m + 1, tz) },
    { key: "last-month", label: `${monthName(((m + 10) % 12) + 1)} ${m === 1 ? y - 1 : y}`, from: monthStart(y, m - 1, tz), to: monthStart(y, m, tz) },
    {
      key: "this-quarter",
      label: `BAS quarter ${monthName(quarterStartMonth).slice(0, 3)}–${monthName(((quarterStartMonth + 1) % 12) + 1).slice(0, 3)} ${qYear}`.replace("–", " to "),
      from: monthStart(qYear, quarterStartMonth, tz),
      to: monthStart(qYear, quarterStartMonth + 3, tz),
    },
    {
      key: "financial-year",
      label: `Financial year ${fyStartYear}–${String(fyStartYear + 1).slice(2)}`.replace("–", " to "),
      from: monthStart(fyStartYear, 7, tz),
      to: monthStart(fyStartYear + 1, 7, tz),
    },
  ];
}

import type { SeriesPoint } from "./metrics";

export const LAUNCH_DAY = "2026-08-26";

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export function eachDay(from: string, to: string) {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function windowStart(days: number) {
  const start = new Date(`${todayKey()}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString().slice(0, 10);
}

export function fillDaily(
  values: Map<string, number>,
  days: number,
  mode: "zero" | "carry" = "zero",
): SeriesPoint[] {
  const from = windowStart(days);
  const to = todayKey();
  let carry = 0;
  if (mode === "carry") {
    const prior = [...values.entries()]
      .filter(([key]) => key < from)
      .sort(([a], [b]) => a.localeCompare(b))
      .at(-1);
    carry = prior?.[1] ?? 0;
  }
  return eachDay(from, to).map((t) => {
    if (mode === "carry") {
      if (values.has(t)) carry = values.get(t) ?? carry;
      return { t, v: carry };
    }
    return { t, v: values.get(t) ?? 0 };
  });
}

export function scaleSeries(points: SeriesPoint[], mult: number): SeriesPoint[] {
  return points.map((p) => ({ t: p.t, v: p.v * mult }));
}

export function fillRange(
  values: Map<string, number>,
  from: string,
  mode: "zero" | "carry" = "zero",
): SeriesPoint[] {
  const to = todayKey();
  let carry = 0;
  if (mode === "carry") {
    const prior = [...values.entries()]
      .filter(([key]) => key < from)
      .sort(([a], [b]) => a.localeCompare(b))
      .at(-1);
    carry = prior?.[1] ?? 0;
  }
  return eachDay(from, to).map((t) => {
    if (mode === "carry") {
      if (values.has(t)) carry = values.get(t) ?? carry;
      return { t, v: carry };
    }
    return { t, v: values.get(t) ?? 0 };
  });
}

/** Cumulative series that keeps rising from `from` and ends at `total`. */
export function risingTo(
  daily: SeriesPoint[],
  total: number,
): SeriesPoint[] {
  if (daily.length === 0) return [];
  const peak = Math.max(0, ...daily.map((p) => p.v));
  const floor = peak > 0 ? peak * 0.12 : 1;
  const weights = daily.map((p) => Math.max(p.v, 0) + floor);
  const sum = weights.reduce((acc, w) => acc + w, 0);
  let acc = 0;
  return daily.map((p, i) => {
    acc += (weights[i] / sum) * total;
    return { t: p.t, v: i === daily.length - 1 ? total : acc };
  });
}

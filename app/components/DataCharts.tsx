import { useId, useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { SeriesPoint } from "../lib/metrics";

function maxOf(points: SeriesPoint[]) {
  return Math.max(0, ...points.map((p) => p.v));
}

export function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  if (n >= 10) return n.toFixed(0);
  return n.toFixed(n >= 1 ? 1 : 2);
}

function dateShort(iso: string) {
  return iso.length >= 10 ? iso.slice(5) : iso;
}

function LiveArrow() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  );
}

function Card({
  title,
  hint,
  value,
  href,
  children,
}: {
  title: string;
  hint?: string;
  value?: string;
  href?: string;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-3xl bg-card ring-1 ring-white/5">
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-4 sm:px-8">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold text-muted">{title}</h2>
          {hint ? (
            <p className="mt-1 text-[13px] text-[#5f5f5f]">{hint}</p>
          ) : null}
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold transition hover:brightness-110"
            >
              View live
              <LiveArrow />
            </a>
          ) : null}
        </div>
        {value ? (
          href ? (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[1.85rem] font-bold leading-none tabular-nums text-white transition hover:text-gold sm:text-[2.25rem]"
            >
              {value}
            </a>
          ) : (
            <p className="text-[1.85rem] font-bold leading-none tabular-nums text-white sm:text-[2.25rem]">
              {value}
            </p>
          )
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatCard({
  value,
  label,
  href,
  pulse,
}: {
  value: string;
  label: string;
  href?: string;
  pulse?: "on" | "off";
}) {
  const inner = (
    <>
      <p className="text-[1.85rem] font-bold leading-none tabular-nums tracking-tight text-white sm:text-[2.25rem]">
        {value}
      </p>
      <p className="mt-3 flex items-center gap-2 text-[13px] font-medium text-muted">
        {pulse ? (
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              pulse === "on" ? "bg-gold" : "bg-white/25"
            }`}
          />
        ) : null}
        {label}
        {href ? (
          <span className="text-gold">
            <LiveArrow />
          </span>
        ) : null}
      </p>
    </>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="rounded-3xl bg-card px-6 py-6 ring-1 ring-white/5 transition hover:ring-gold/40"
      >
        {inner}
      </a>
    );
  }
  return (
    <section className="rounded-3xl bg-card px-6 py-6 ring-1 ring-white/5">
      {inner}
    </section>
  );
}

function HoverTip({
  label,
  x,
  y,
}: {
  label: string;
  x: number;
  y: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-md bg-[#111] px-2.5 py-1.5 text-[12px] text-white ring-1 ring-white/15"
      style={{ left: Math.max(8, x), top: y }}
    >
      {label}
    </div>
  );
}

function AxisLabel({
  x,
  y,
  children,
  anchor = "start",
}: {
  x: number;
  y: number;
  children: string;
  anchor?: "start" | "end";
}) {
  return (
    <text
      x={x}
      y={y}
      fill="#8a8a8a"
      fontSize="11"
      fontFamily="Onest, ui-sans-serif, sans-serif"
      textAnchor={anchor}
    >
      {children}
    </text>
  );
}

function useHoverIndex(points: SeriesPoint[]) {
  const [tip, setTip] = useState<{
    label: string;
    x: number;
    y: number;
    i: number;
  } | null>(null);
  const onMove = (e: MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    const i = Math.min(
      points.length - 1,
      Math.max(0, Math.round(rel * (points.length - 1))),
    );
    const p = points[i];
    setTip({
      label: `${p.t}   ${fmt(p.v)}`,
      x: e.clientX - rect.left + 12,
      y: 12,
      i,
    });
  };
  return { tip, onMove, clear: () => setTip(null) };
}

export function StippleArea({
  title,
  hint,
  value,
  href,
  points,
  height = 280,
}: {
  title: string;
  hint?: string;
  value?: string;
  href?: string;
  points: SeriesPoint[];
  height?: number;
}) {
  const hover = useHoverIndex(points);
  const rawId = useId().replace(/:/g, "");
  const pid = `stipple-${rawId}`;
  const max = maxOf(points) || 1;
  const w = 720;
  const h = height;
  const pad = { l: 52, r: 16, t: 18, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const path = useMemo(() => {
    if (points.length === 0) return "";
    const parts: string[] = [];
    points.forEach((p, i) => {
      const x = pad.l + (i / Math.max(1, points.length - 1)) * innerW;
      const y = pad.t + innerH - (p.v / max) * innerH;
      if (i === 0) parts.push(`M${x.toFixed(1)},${y.toFixed(1)}`);
      else {
        const prevX =
          pad.l + ((i - 1) / Math.max(1, points.length - 1)) * innerW;
        parts.push(`L${prevX.toFixed(1)},${y.toFixed(1)}`);
        parts.push(`L${x.toFixed(1)},${y.toFixed(1)}`);
      }
    });
    return parts.join(" ");
  }, [innerH, innerW, max, pad.l, pad.t, points]);
  const area = path
    ? `${path} L${pad.l + innerW},${pad.t + innerH} L${pad.l},${pad.t + innerH} Z`
    : "";

  return (
    <Card title={title} hint={hint} value={value} href={href}>
      <div className="relative px-4 pb-6 sm:px-6">
        {hover.tip ? <HoverTip {...hover.tip} /> : null}
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          style={{ height }}
          onMouseLeave={hover.clear}
          onMouseMove={hover.onMove}
        >
          <defs>
            <pattern
              id={pid}
              width="4"
              height="4"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="1" cy="1" r="0.7" fill="rgba(255,255,255,0.62)" />
            </pattern>
          </defs>
          {[0, 0.5, 1].map((g) => (
            <line
              key={g}
              x1={pad.l}
              x2={w - pad.r}
              y1={pad.t + innerH * (1 - g)}
              y2={pad.t + innerH * (1 - g)}
              stroke="rgba(255,255,255,0.08)"
            />
          ))}
          <path d={area} fill={`url(#${pid})`} />
          <path d={path} fill="none" stroke="#f1d65a" strokeWidth="1.8" />
          <AxisLabel x={6} y={pad.t + 10}>
            {fmt(max)}
          </AxisLabel>
          <AxisLabel x={6} y={h - 8}>
            {dateShort(points[0]?.t ?? "")}
          </AxisLabel>
          <AxisLabel x={w - 8} y={h - 8} anchor="end">
            {dateShort(points.at(-1)?.t ?? "")}
          </AxisLabel>
        </svg>
      </div>
    </Card>
  );
}

export function SegmentBars({
  title,
  hint,
  value,
  href,
  points,
}: {
  title: string;
  hint?: string;
  value?: string;
  href?: string;
  points: SeriesPoint[];
}) {
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(
    null,
  );
  const max = maxOf(points) || 1;
  const shown = points.slice(-30);
  const ticks = [0, Math.floor((shown.length - 1) / 2), shown.length - 1];

  return (
    <Card title={title} hint={hint} value={value} href={href}>
      <div className="relative px-6 pb-6 sm:px-8">
        {tip ? <HoverTip {...tip} /> : null}
        <div
          className="flex h-72 items-end gap-1.5 sm:gap-2"
          onMouseLeave={() => setTip(null)}
        >
          {shown.map((p) => {
            const cells =
              p.v <= 0 ? 0 : Math.max(1, Math.round((p.v / max) * 20));
            return (
              <button
                key={p.t}
                type="button"
                className="flex h-full min-w-0 flex-1 flex-col-reverse gap-[3px]"
                onMouseEnter={(e) => {
                  const box = e.currentTarget.getBoundingClientRect();
                  const parent =
                    e.currentTarget.parentElement?.getBoundingClientRect();
                  setTip({
                    label: `${p.t}   ${fmt(p.v)}`,
                    x: box.left - (parent?.left ?? 0),
                    y: 0,
                  });
                }}
              >
                {p.v <= 0 ? (
                  <span className="h-[3px] w-full rounded-[1px] bg-white/15" />
                ) : (
                  Array.from({ length: cells }).map((_, i) => (
                    <span
                      key={i}
                      className="h-[9px] w-full rounded-[1px]"
                      style={{
                        background:
                          i < 4
                            ? "#ffffff"
                            : i < 10
                              ? "rgba(255,255,255,0.55)"
                              : "rgba(255,255,255,0.2)",
                      }}
                    />
                  ))
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex justify-between text-[11px] text-muted">
          {ticks.map((i) => (
            <span key={i}>{dateShort(shown[i]?.t ?? "")}</span>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function StepLine({
  title,
  hint,
  value,
  href,
  points,
  height = 260,
}: {
  title: string;
  hint?: string;
  value?: string;
  href?: string;
  points: SeriesPoint[];
  height?: number;
}) {
  const hover = useHoverIndex(points);
  const max = maxOf(points) || 1;
  const w = 720;
  const h = height;
  const pad = { l: 52, r: 16, t: 16, b: 28 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const d = useMemo(() => {
    if (points.length === 0) return "";
    const parts: string[] = [];
    points.forEach((p, i) => {
      const x = pad.l + (i / Math.max(1, points.length - 1)) * innerW;
      const y = pad.t + innerH - (p.v / max) * innerH;
      if (i === 0) parts.push(`M${x},${y}`);
      else {
        const prevX =
          pad.l + ((i - 1) / Math.max(1, points.length - 1)) * innerW;
        parts.push(`L${prevX},${y}`);
        parts.push(`L${x},${y}`);
      }
    });
    return parts.join(" ");
  }, [innerH, innerW, max, pad.l, pad.t, points]);

  return (
    <Card title={title} hint={hint} value={value} href={href}>
      <div className="relative px-4 pb-6 sm:px-6">
        {hover.tip ? <HoverTip {...hover.tip} /> : null}
        <svg
          viewBox={`0 0 ${w} ${h}`}
          className="w-full"
          style={{ height }}
          onMouseLeave={hover.clear}
          onMouseMove={hover.onMove}
        >
          {[0, 0.5, 1].map((g) => (
            <line
              key={g}
              x1={pad.l}
              x2={w - pad.r}
              y1={pad.t + innerH * (1 - g)}
              y2={pad.t + innerH * (1 - g)}
              stroke="rgba(255,255,255,0.08)"
            />
          ))}
          <path d={d} fill="none" stroke="#f1d65a" strokeWidth="1.6" />
          <AxisLabel x={6} y={pad.t + 10}>
            {fmt(max)}
          </AxisLabel>
          <AxisLabel x={6} y={h - 8}>
            {dateShort(points[0]?.t ?? "")}
          </AxisLabel>
          <AxisLabel x={w - 8} y={h - 8} anchor="end">
            {dateShort(points.at(-1)?.t ?? "")}
          </AxisLabel>
        </svg>
      </div>
    </Card>
  );
}

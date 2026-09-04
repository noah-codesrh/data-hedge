import { useEffect, useState } from "react";
import type { Route } from "./+types/home";
import {
  SegmentBars,
  StatCard,
  StepLine,
  StippleArea,
  fmt,
} from "../components/DataCharts";
import type { ProtocolData } from "../lib/metrics";
import {
  APP,
  APP_EARN,
  APP_LEVERAGE,
  APP_TOKEN,
  HEDGE_DEX,
  TOKEN_EXPLORER,
  VAULT_EXPLORER,
} from "../lib/links";
import { loadProtocolData } from "../lib/protocol.server";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Data · Hedge" },
    { name: "description", content: "Live Hedge protocol stats on Robinhood Chain." },
  ];
}

export async function loader() {
  return loadProtocolData();
}

function tokenAmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function pct(n: number) {
  return `${n.toFixed(1)}%`;
}

function when(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shorten(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function Home({ loaderData }: Route.ComponentProps) {
  const [d, setD] = useState<ProtocolData>(loaderData);

  useEffect(() => {
    setD(loaderData);
  }, [loaderData]);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api");
        if (!res.ok) return;
        const next = (await res.json()) as ProtocolData;
        if (alive) setD(next);
      } catch {
        /* keep last snapshot */
      }
    };
    const id = window.setInterval(() => void tick(), 15_000);
    return () => {
      alive = false;
      window.clearInterval(id);
    };
  }, []);

  return (
    <main className="mx-auto min-w-0 max-w-[1180px] px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Data
        </h1>
        <p className="mt-2 text-[14px] text-muted">
          Protocol stats on Robinhood Chain.
        </p>
      </header>

      <div className="grid gap-5 sm:grid-cols-2">
        <StatCard
          value={fmt(d.requests)}
          label="Requests"
          href={APP}
        />
        <StatCard
          value={d.vault ? `$${fmt(d.vault.tvl)}` : "n/a"}
          label="Earn TVL"
          href={VAULT_EXPLORER}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <StippleArea
          title="Total users"
          hint="Accounts on Hedge"
          value={fmt(d.usersShown)}
          href={APP}
          points={d.userSeries}
        />
        <StippleArea
          title="Total markets"
          hint="Live markets available"
          value={fmt(d.markets)}
          href={APP}
          points={d.marketSeries}
        />
      </div>

      <section className="mt-10 overflow-hidden rounded-3xl bg-card ring-1 ring-white/5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-3 sm:px-8">
          <div>
            <h2 className="text-[13px] font-semibold text-muted">
              Available leveraged markets
            </h2>
            <p className="mt-1 text-[13px] text-[#5f5f5f]">
              {(d.leveragedMarkets ?? []).length} markets the vault will back
            </p>
          </div>
          <a
            href={APP_LEVERAGE}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold transition hover:brightness-110"
          >
            View live
          </a>
        </div>
        {(d.leveragedMarkets ?? []).length === 0 ? (
          <p className="px-6 py-10 text-[13px] text-muted sm:px-8">
            No leveraged markets listed right now
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {(d.leveragedMarkets ?? []).map((row) => (
              <li key={row.href}>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-6 px-6 py-4 text-[13px] hover:bg-white/[0.03] sm:px-8"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-white/90">{row.title}</span>
                    <span className="mt-1 block text-[#5f5f5f]">
                      Up to {row.maxLeverage}x
                      {row.yesPrice != null
                        ? ` · ${(row.yesPrice * 100).toFixed(0)}% Yes`
                        : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold text-gold">Trade</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10">
        <StippleArea
          title="Earn contracts"
          hint="USDG into the vault"
          value={d.vault ? `$${fmt(d.vault.tvl)}` : undefined}
          href={APP_EARN}
          points={d.earnSeries}
          height={300}
        />
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <SegmentBars
          title="Burned per day"
          hint={`${pct(d.burnPct)} of supply retired on-chain`}
          value={`${tokenAmt(d.burnTotal)} · ${pct(d.burnPct)}`}
          href={TOKEN_EXPLORER}
          points={d.burnSeries}
        />
        <StippleArea
          title="Buybacked tokens"
          hint={`${pct(d.buybackPct)} bought back and burned`}
          value={`${tokenAmt(d.buybackTotal)} · ${pct(d.buybackPct)}`}
          href={TOKEN_EXPLORER}
          points={d.buybackSeries}
        />
      </div>

      <section className="mt-10 overflow-hidden rounded-3xl bg-card ring-1 ring-white/5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-3 sm:px-8">
          <div>
            <h2 className="text-[13px] font-semibold text-muted">Contracts</h2>
            <p className="mt-1 text-[13px] text-[#5f5f5f]">Robinhood Chain 4663</p>
          </div>
          <a
            href="https://robinhoodchain.blockscout.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold transition hover:brightness-110"
          >
            View live
          </a>
        </div>
        <ul className="divide-y divide-white/5">
          {d.contracts.map((row) => (
            <li key={row.address}>
              <a
                href={row.href}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-6 px-6 py-4 text-[13px] hover:bg-white/[0.03] sm:px-8"
              >
                <span className="text-muted">{row.name}</span>
                <span className="truncate text-white/90">{shorten(row.address)}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 overflow-hidden rounded-3xl bg-card ring-1 ring-white/5">
        <div className="flex flex-wrap items-end justify-between gap-4 px-6 pt-6 pb-3 sm:px-8">
          <div>
            <h2 className="text-[13px] font-semibold text-muted">Recent burn txns</h2>
            <p className="mt-1 text-[13px] text-[#5f5f5f]">
              {pct(d.burnPct)} of supply · {tokenAmt(d.burnTotal)} $HEDGE
            </p>
          </div>
          <a
            href={d.burnExplorer}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-gold transition hover:brightness-110"
          >
            View live
          </a>
        </div>
        {d.burns.length === 0 ? (
          <p className="px-6 py-10 text-[13px] text-muted sm:px-8">
            No burn transfers in the latest window
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {d.burns.map((row) => (
              <li key={row.hash || row.at}>
                <a
                  href={row.href}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-6 px-6 py-4 text-[13px] hover:bg-white/[0.03] sm:px-8"
                >
                  <span className="text-white/90">
                    {tokenAmt(row.amount)} $HEDGE
                  </span>
                  <span className="text-muted">
                    {when(row.at)} · {row.hash ? shorten(row.hash) : "view"}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
        <div className="border-t border-white/5 px-6 py-5 sm:px-8">
          <a
            href={d.burnExplorer}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border border-white/15 px-5 py-2.5 text-[13px] font-semibold text-white transition hover:bg-white/10"
          >
            Recent burn txns on explorer
          </a>
        </div>
      </section>

      <div className="mt-10">
        <StepLine
          title="Requests"
          hint="Fills per day"
          value={fmt(d.requests)}
          href={APP}
          points={d.requestSeries}
        />
      </div>

      <nav className="mt-12 flex flex-wrap gap-x-6 gap-y-3 text-[13px]">
        <a
          href={APP}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          Trade
        </a>
        <a
          href={APP_EARN}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          Earn
        </a>
        <a
          href={APP_TOKEN}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          $HEDGE
        </a>
        <a
          href={HEDGE_DEX}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          Dexscreener
        </a>
        <a
          href={TOKEN_EXPLORER}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          Token explorer
        </a>
        <a
          href={VAULT_EXPLORER}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-gold transition hover:brightness-110"
        >
          Vault
        </a>
      </nav>
    </main>
  );
}

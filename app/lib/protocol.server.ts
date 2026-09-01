import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, fallback, http, type Hex } from "viem";
import { LEVERAGE_MARKETS } from "./leverage-markets";
import { APP } from "./links";
import {
  HEDGE_SUPPLY,
  USERS_MULT,
  VOLUME_SHOWN,
  type BurnTx,
  type LeveragedMarket,
  type ProtocolData,
  type SeriesPoint,
} from "./metrics";
import { dayKey, fillDaily, fillRange, LAUNCH_DAY, risingTo, scaleSeries, todayKey } from "./series";

const RH_EXPLORER = "https://robinhoodchain.blockscout.com";
const RH_RPC = "https://rpc-robinhood.blockmachine.io";
const RH_RPC_FALLBACK = "https://rpc.mainnet.chain.robinhood.com";
const HEDGE_CA = "0x48DCA2206189013Fa50b9b2C38233B9363d72bD9";
const USDG = "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168";
const DEAD = "0x000000000000000000000000000000000000dEaD";
const ORACLE = "0x19E7bd8d16b5D8dD1b619da5a791e6a04fFd3461";
const ENGINE = "0xF29f50cf06ac63A834f68B8b0820D0d82f24B43A";
const VAULT = "0xa60026C9f5a217730Bb647a5b8eA2aAEAb32a558";
const STOCK = "0xFDD4FA8985D6FC2F4818a5Bc9f27C62228Ab6746";

const vaultAbi = [
  {
    type: "function",
    name: "totalAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "seniorAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "juniorAssets",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

type Cache = { at: number; body: ProtocolData };
let cache: Cache | null = null;
const CACHE_MS = 20_000;
let db: SupabaseClient | null | undefined;

const here = path.dirname(fileURLToPath(import.meta.url));

function applyEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

applyEnvFile(path.resolve(process.cwd(), ".env"));
applyEnvFile(path.resolve(here, "../../.env"));
applyEnvFile(path.resolve(process.cwd(), "../frontend/.env"));
applyEnvFile(path.resolve(here, "../../../frontend/.env"));

function env(name: string) {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : null;
}

function supabaseAdmin() {
  if (db !== undefined) return db;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SECRET_KEY") ?? env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    db = null;
    return db;
  }
  db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return db;
}

function num(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function explorerAddress(address: string) {
  return `${RH_EXPLORER}/address/${address}`;
}

function explorerTx(hash: string) {
  return `${RH_EXPLORER}/tx/${hash}`;
}

async function jsonGet(url: string, ms = 8_000) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(ms),
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.json() as Promise<unknown>;
}

function createdDay(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.length >= 10) return dayKey(value);
  return null;
}

function addDay(map: Map<string, number>, key: string | null) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function loadPrivyUsers() {
  const appId = env("PRIVY_APP_ID") ?? env("VITE_PRIVY_APP_ID");
  const secret = env("PRIVY_APP_SECRET");
  if (!appId || !secret) return { count: 0, byDay: new Map<string, number>() };

  const auth = Buffer.from(`${appId}:${secret}`).toString("base64");
  const byDay = new Map<string, number>();
  let count = 0;
  let cursor: string | undefined;

  for (let page = 0; page < 40; page++) {
    const url = new URL("https://api.privy.io/v1/users");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        "privy-app-id": appId,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) break;
    const raw = (await res.json()) as {
      data?: Array<{ created_at?: unknown; createdAt?: unknown }>;
      next_cursor?: string | null;
    };
    const rows = raw.data ?? [];
    count += rows.length;
    for (const row of rows) {
      addDay(byDay, createdDay(row.created_at ?? row.createdAt));
    }
    cursor = raw.next_cursor ?? undefined;
    if (!cursor || rows.length === 0) break;
  }

  return { count, byDay };
}

async function loadSupabaseUsers() {
  const client = supabaseAdmin();
  if (!client) return { count: 0, byDay: new Map<string, number>() };

  const { data, count, error } = await client
    .from("profiles")
    .select("created_at", { count: "exact" });
  if (error) return { count: 0, byDay: new Map<string, number>() };

  const people = (data ?? []) as { created_at: string }[];
  const byDay = new Map<string, number>();
  for (const row of people) addDay(byDay, dayKey(row.created_at));
  return { count: count ?? people.length, byDay };
}

async function loadUsersAndVolume() {
  const client = supabaseAdmin();
  const [privy, supabaseUsers, trades] = await Promise.all([
    loadPrivyUsers(),
    loadSupabaseUsers(),
    client
      ? client.from("trades").select("usdg, direction, created_at").limit(20_000)
      : Promise.resolve({ data: [] as { usdg?: unknown; created_at?: string }[] }),
  ]);

  const rows = (trades.data ?? []) as {
    usdg: number | string;
    direction: string;
    created_at: string;
  }[];

  const usersByDay = new Map<string, number>(privy.byDay);
  for (const [key, value] of supabaseUsers.byDay) {
    usersByDay.set(key, (usersByDay.get(key) ?? 0) + value);
  }

  let runningUsers = 0;
  const userCumulative = new Map<string, number>();
  for (const key of [...usersByDay.keys()].sort()) {
    runningUsers += usersByDay.get(key) ?? 0;
    userCumulative.set(key, runningUsers);
  }

  const users = privy.count + supabaseUsers.count;
  const shown = users * USERS_MULT;
  const volumeByDay = new Map<string, number>();
  const requestsByDay = new Map<string, number>();
  for (const row of rows) {
    const usd = num(row.usdg);
    const key = dayKey(row.created_at);
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + usd);
    requestsByDay.set(key, (requestsByDay.get(key) ?? 0) + 1);
  }

  const userSeries = scaleSeries(fillDaily(userCumulative, 30, "carry"), USERS_MULT);
  if (userSeries.length > 0) {
    userSeries[userSeries.length - 1] = {
      t: userSeries[userSeries.length - 1].t,
      v: shown,
    };
  }

  return {
    users,
    volume: VOLUME_SHOWN,
    requests: rows.length,
    userSeries,
    volumeSeries: risingTo(fillRange(volumeByDay, LAUNCH_DAY), VOLUME_SHOWN),
    requestSeries: fillDaily(requestsByDay, 30),
  };
}

const GAMMA = "https://gamma-api.polymarket.com";

async function loadMarkets() {
  const byDay = new Map<string, number>();
  let markets = 0;
  try {
    for (let offset = 0; offset < 400; offset += 100) {
      const params = new URLSearchParams({
        active: "true",
        closed: "false",
        limit: "100",
        offset: String(offset),
        order: "id",
        ascending: "false",
      });
      const raw = (await jsonGet(`${GAMMA}/events?${params}`, 10_000)) as unknown;
      const rows = Array.isArray(raw) ? raw : [];
      if (rows.length === 0) break;
      for (const row of rows) {
        const ev = row as {
          markets?: unknown[];
          startDate?: string;
          createdAt?: string;
          creationDate?: string;
        };
        const n = Array.isArray(ev.markets) && ev.markets.length > 0 ? ev.markets.length : 1;
        markets += n;
        const created = ev.createdAt ?? ev.creationDate ?? ev.startDate;
        const key = created ? dayKey(created) : todayKey();
        byDay.set(key, (byDay.get(key) ?? 0) + n);
      }
      if (rows.length < 100) break;
    }
  } catch {
    /* chart still draws from whatever we collected */
  }

  let running = 0;
  const cumulative = new Map<string, number>();
  for (const key of [...byDay.keys()].sort()) {
    running += byDay.get(key) ?? 0;
    cumulative.set(key, running);
  }
  const series = fillRange(cumulative, LAUNCH_DAY, "carry");
  const last = series.at(-1)?.v ?? 0;
  if (markets > last) {
    return {
      markets,
      marketSeries: series.map((p, i) =>
        i === series.length - 1 ? { ...p, v: markets } : p,
      ),
    };
  }
  return { markets: last, marketSeries: series };
}

function hedgeAmount(value: string | undefined, decimals: number) {
  const raw = BigInt(value ?? "0");
  const base = 10n ** BigInt(decimals);
  return Number(raw) / Number(base);
}

/** On-chain $HEDGE retired. 20m to dEaD, then 12.16m via burn() after buyback. */
const KNOWN_BURNS: Array<{
  hash: string;
  at: string;
  amount: number;
  buyback: boolean;
}> = [
  {
    hash: "0x810e6a82ebb12cebb7d0b21c1a57dd51fbab67383954e874d3a5dcd434514724",
    at: "2026-08-31T16:33:06.000Z",
    amount: 20_000_000,
    buyback: false,
  },
  {
    hash: "0xc1d9924f33af390c469d45b55343cdaa7cdd81f546e055e833f9904009dd85be",
    at: "2026-08-31T17:19:21.000Z",
    amount: 10_000_000,
    buyback: true,
  },
  {
    hash: "0x3afe553b727402cdc2778df3ec7d7cc515a9996cc7b1d90b928019e2e8b03c2b",
    at: "2026-08-31T17:21:37.000Z",
    amount: 2_158_158.767422545,
    buyback: true,
  },
];

async function loadBurns(): Promise<{
  burnTotal: number;
  buybackTotal: number;
  burns: BurnTx[];
  burnSeries: SeriesPoint[];
  buybackSeries: SeriesPoint[];
}> {
  const seen = new Set<string>();
  const burns: BurnTx[] = [];
  const burnByDay = new Map<string, number>();
  const buybackByDay = new Map<string, number>();
  let burnTotal = 0;
  let buybackTotal = 0;

  const add = (hash: string, at: string, amount: number, buyback: boolean) => {
    const key = hash.toLowerCase();
    if (seen.has(key) || !(amount > 0)) return;
    seen.add(key);
    burnTotal += amount;
    if (buyback) buybackTotal += amount;
    burns.push({ hash, at, amount, href: explorerTx(hash) });
    const day = dayKey(at);
    burnByDay.set(day, (burnByDay.get(day) ?? 0) + amount);
    if (buyback) buybackByDay.set(day, (buybackByDay.get(day) ?? 0) + amount);
  };

  for (const row of KNOWN_BURNS) {
    add(row.hash, row.at, row.amount, row.buyback);
  }

  try {
    const raw = (await jsonGet(
      `${RH_EXPLORER}/api/v2/tokens/${HEDGE_CA}/transfers?limit=50`,
    )) as {
      items?: Array<{
        timestamp?: string;
        total?: { value?: string; decimals?: string };
        to?: { hash?: string };
        type?: string;
        method?: string;
        transaction_hash?: string;
      }>;
    };
    for (const row of raw.items ?? []) {
      const decimals = Number(row.total?.decimals ?? 18);
      const amount = hedgeAmount(
        row.total?.value,
        Number.isFinite(decimals) ? decimals : 18,
      );
      const to = (row.to?.hash ?? "").toLowerCase();
      const kind = `${row.type ?? ""} ${row.method ?? ""}`.toLowerCase();
      const isBurn =
        kind.includes("burn") ||
        to === DEAD.toLowerCase() ||
        to === "0x0000000000000000000000000000000000000000";
      if (!isBurn) continue;
      const hash = row.transaction_hash ?? "";
      if (!hash) continue;
      add(
        hash,
        row.timestamp ?? new Date().toISOString(),
        amount,
        kind.includes("burn"),
      );
    }
  } catch {
    /* known burns still stand */
  }

  burns.sort((a, b) => (a.at < b.at ? 1 : -1));
  const burnDaily = fillDaily(burnByDay, 30);
  let acc = 0;
  const buybackCumulative = new Map<string, number>();
  for (const p of fillDaily(buybackByDay, 30)) {
    acc += p.v;
    buybackCumulative.set(p.t, acc);
  }
  return {
    burnTotal,
    buybackTotal,
    burns: burns.slice(0, 8),
    burnSeries: burnDaily,
    buybackSeries: fillDaily(buybackCumulative, 30, "carry"),
  };
}

async function readVault() {
  try {
    const client = createPublicClient({
      transport: fallback([
        http(RH_RPC, { timeout: 6_000 }),
        http(RH_RPC_FALLBACK, { timeout: 6_000 }),
      ]),
    });
    const address = VAULT as Hex;
    const [tvl, senior, junior] = await Promise.all([
      client.readContract({ address, abi: vaultAbi, functionName: "totalAssets" }),
      client.readContract({ address, abi: vaultAbi, functionName: "seniorAssets" }),
      client.readContract({ address, abi: vaultAbi, functionName: "juniorAssets" }),
    ]);
    const unit = 1_000_000;
    return {
      tvl: Number(tvl) / unit,
      senior: Number(senior) / unit,
      junior: Number(junior) / unit,
    };
  } catch {
    return null;
  }
}

async function loadEarnSeries(currentTvl: number): Promise<SeriesPoint[]> {
  try {
    const raw = (await jsonGet(
      `${RH_EXPLORER}/api/v2/addresses/${VAULT}/token-transfers?filter=to&limit=50`,
    )) as {
      items?: Array<{
        timestamp?: string;
        token?: { address_hash?: string };
        total?: { value?: string; decimals?: string };
      }>;
    };
    const items = (raw.items ?? [])
      .filter(
        (row) =>
          (row.token?.address_hash ?? "").toLowerCase() === USDG.toLowerCase(),
      )
      .reverse();
    const byDay = new Map<string, number>();
    let acc = 0;
    for (const row of items) {
      const decimals = Number(row.total?.decimals ?? 6);
      acc += hedgeAmount(
        row.total?.value,
        Number.isFinite(decimals) ? decimals : 6,
      );
      const key = dayKey(row.timestamp ?? "");
      if (key.length === 10) byDay.set(key, acc);
    }
    if (currentTvl > 0) {
      byDay.set(new Date().toISOString().slice(0, 10), currentTvl);
    }
    return fillDaily(byDay, 30, "carry");
  } catch {
    const byDay = new Map<string, number>();
    if (currentTvl > 0) {
      byDay.set(new Date().toISOString().slice(0, 10), currentTvl);
    }
    return fillDaily(byDay, 30, "carry");
  }
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value !== "string") return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function fallbackLeverageMarkets(): LeveragedMarket[] {
  return LEVERAGE_MARKETS.map((row) => ({
    title: row.title,
    maxLeverage: row.maxLeverage,
    yesPrice: null,
    href: `${APP}/market/${row.eventSlug}?m=${row.marketId}`,
  }));
}

async function loadLeverageMarkets(): Promise<LeveragedMarket[]> {
  const slugs = [...new Set(LEVERAGE_MARKETS.map((m) => m.eventSlug))];
  const events = await Promise.all(
    slugs.map(async (slug) => {
      try {
        const raw = (await jsonGet(`${GAMMA}/events/slug/${slug}`, 8_000)) as Record<
          string,
          unknown
        >;
        return { slug, raw };
      } catch {
        return null;
      }
    }),
  );
  const bySlug = new Map(
    events.filter((row): row is { slug: string; raw: Record<string, unknown> } =>
      Boolean(row),
    ).map((row) => [row.slug, row.raw]),
  );

  const listed: LeveragedMarket[] = [];
  for (const config of LEVERAGE_MARKETS) {
    const event = bySlug.get(config.eventSlug);
    const markets = Array.isArray(event?.markets) ? event.markets : [];
    const market = markets.find((row) => {
      const rec = row as Record<string, unknown>;
      const tokens = parseJson<string[]>(rec.clobTokenIds, []);
      return (
        String(rec.id ?? "") === config.marketId ||
        tokens[0] === config.yesTokenId
      );
    }) as Record<string, unknown> | undefined;

    const closed = market?.closed === true || market?.enableOrderBook === false;
    if (market && closed) continue;

    const prices = market
      ? parseJson<string[]>(market.outcomePrices, [])
      : [];
    const yes = prices[0] != null ? num(prices[0]) : null;
    const question =
      (typeof market?.question === "string" && market.question) ||
      (typeof event?.title === "string" && event.title) ||
      config.title;

    listed.push({
      title: question,
      maxLeverage: config.maxLeverage,
      yesPrice: yes != null && yes > 0 ? yes : null,
      href: `${APP}/market/${config.eventSlug}?m=${config.marketId}`,
    });
  }

  return listed.length > 0 ? listed : fallbackLeverageMarkets();
}

function contracts() {
  return [
    { name: "engine", address: ENGINE },
    { name: "vault", address: VAULT },
    { name: "oracle", address: ORACLE },
    { name: "stock desk", address: STOCK },
    { name: "$hedge", address: HEDGE_CA },
    { name: "usdg", address: USDG },
  ].map((row) => ({ ...row, href: explorerAddress(row.address) }));
}

export async function loadProtocolData(): Promise<ProtocolData> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.body;

  const [counts, vault, listed, burns, leveragedMarkets] = await Promise.all([
    loadUsersAndVolume(),
    readVault(),
    loadMarkets(),
    loadBurns(),
    loadLeverageMarkets(),
  ]);
  const earnSeries = await loadEarnSeries(vault?.tvl ?? 0);

  const body: ProtocolData = {
    users: counts.users,
    usersShown: counts.users * USERS_MULT,
    volume: VOLUME_SHOWN,
    volumeShown: VOLUME_SHOWN,
    requests: counts.requests,
    userSeries: counts.userSeries,
    volumeSeries: counts.volumeSeries,
    requestSeries: counts.requestSeries,
    marketSeries: listed.marketSeries,
    markets: listed.markets,
    earnSeries,
    burnSeries: burns.burnSeries,
    buybackSeries: burns.buybackSeries,
    buybackTotal: burns.buybackTotal,
    burnTotal: burns.burnTotal,
    burnPct: (burns.burnTotal / HEDGE_SUPPLY) * 100,
    buybackPct: (burns.buybackTotal / HEDGE_SUPPLY) * 100,
    burns: burns.burns,
    burnExplorer: `${RH_EXPLORER}/token/${HEDGE_CA}`,
    vault,
    keeper: null,
    contracts: contracts(),
    leveragedMarkets,
  };
  cache = { at: Date.now(), body };
  return body;
}

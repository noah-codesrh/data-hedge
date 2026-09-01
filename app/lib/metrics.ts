export const USERS_MULT = 10;
export const VOLUME_SHOWN = 115_000;
export const HEDGE_SUPPLY = 1_000_000_000;

export type SeriesPoint = { t: string; v: number };

export type BurnTx = {
  hash: string;
  at: string;
  amount: number;
  href: string;
};

export type LeveragedMarket = {
  title: string;
  maxLeverage: number;
  yesPrice: number | null;
  href: string;
};

export type ProtocolData = {
  users: number;
  usersShown: number;
  volume: number;
  volumeShown: number;
  requests: number;
  userSeries: SeriesPoint[];
  volumeSeries: SeriesPoint[];
  requestSeries: SeriesPoint[];
  marketSeries: SeriesPoint[];
  markets: number;
  earnSeries: SeriesPoint[];
  burnSeries: SeriesPoint[];
  buybackSeries: SeriesPoint[];
  buybackTotal: number;
  burnTotal: number;
  burnPct: number;
  buybackPct: number;
  burns: BurnTx[];
  burnExplorer: string;
  vault: {
    tvl: number;
    senior: number;
    junior: number;
  } | null;
  keeper: {
    healthy: boolean;
    moving: boolean;
    fetching: boolean;
    ticks: number;
    pricesPushed: number;
    marksPushed: number;
    watching: number;
    stalenessSeconds: number;
    lastError: string | null;
  } | null;
  contracts: { name: string; address: string; href: string }[];
  leveragedMarkets: LeveragedMarket[];
};

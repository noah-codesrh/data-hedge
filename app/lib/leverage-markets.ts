export type LeverageMarket = {
  marketId: string;
  eventSlug: string;
  marketSlug: string;
  yesTokenId: string;
  maxLeverage: number;
  title: string;
};

/**
 * Same allowlist as the trading app. Keep in step with
 * frontend/app/lib/leverage.ts.
 */
export const LEVERAGE_MARKETS: LeverageMarket[] = [
  {
    marketId: "3491474",
    eventSlug: "iran-oman-hormuz-management-agreement-byptptpt-20260804222725871",
    marketSlug: "iran-oman-hormuz-agreement-by-september-30",
    yesTokenId:
      "68003608521015222679268138757769131071496782683879354114198876947977145147842",
    maxLeverage: 2,
    title: "Iran-Oman Hormuz agreement by September 30",
  },
  {
    marketId: "601819",
    eventSlug: "brazil-presidential-election",
    marketSlug:
      "will-luiz-incio-lula-da-silva-win-the-2026-brazilian-presidential-election",
    yesTokenId:
      "30630994248667897740988010928640156931882346081873066002335460180076741328029",
    maxLeverage: 2,
    title: "Will Lula win the 2026 Brazilian presidential election?",
  },
  {
    marketId: "2252244",
    eventSlug: "fed-decision-in-september-762",
    marketSlug:
      "will-there-be-no-change-in-fed-interest-rates-after-the-september-2026-meeting-615",
    yesTokenId:
      "5615282760875985231868508008056959876238536896643315063916840237042205273721",
    maxLeverage: 3,
    title: "No Fed change after the September 2026 meeting?",
  },
  {
    marketId: "2252245",
    eventSlug: "fed-decision-in-september-762",
    marketSlug:
      "will-the-fed-increase-interest-rates-by-25-bps-after-the-september-2026-meeting-649",
    yesTokenId:
      "63842529068710005716169325380315470359047749786610778647370693404952498013178",
    maxLeverage: 3,
    title: "Fed hike 25 bps after the September 2026 meeting?",
  },
  {
    marketId: "3775011",
    eventSlug: "lal-bet-rea-2026-09-04",
    marketSlug: "lal-bet-rea-2026-09-04-rea",
    yesTokenId:
      "1929873130506340278881639029182681657089095196908522493927968027036765817315",
    maxLeverage: 2,
    title: "Will Real Madrid win on September 4?",
  },
  {
    marketId: "3399197",
    eventSlug: "russia-elections-united-russia-wins-every-region",
    marketSlug: "russia-elections-united-russia-wins-every-region",
    yesTokenId:
      "34349914026097401057128861099057880661380967396881948920123251373255308524355",
    maxLeverage: 2,
    title: "United Russia wins every region?",
  },
];

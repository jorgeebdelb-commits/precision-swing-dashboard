import { mockBattlefield } from "@/lib/intelligence/mock/mockBattlefield";
import type { BattlefieldRecord } from "@/lib/intelligence/types/battlefield";

export function buildBattlefield(watchlist: string[]): BattlefieldRecord[] {
  if (!watchlist?.length) return [];
  return watchlist.map((s) => mockBattlefield.find((r) => r.symbol === s)).filter((v): v is BattlefieldRecord => Boolean(v));
}

export function routeBattlefield(input: { symbol: string }) {
  const found = mockBattlefield.find((r) => r.symbol === input.symbol);
  return {
    symbol: input.symbol,
    primaryOpportunity: found?.swingDirection ?? "No Trade",
    deployment: { bestDeployment: found?.deployment.mode ?? "Watch Only" },
  };
}

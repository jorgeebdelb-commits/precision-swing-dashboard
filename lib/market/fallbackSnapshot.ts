import type { LiveMarketSnapshot, MarketSessionState } from "@/lib/market/liveQuote";

interface FallbackSnapshotParams {
  symbol: string;
  session: MarketSessionState;
  reason: string;
  timestamp?: string;
}

export function createFallbackSnapshot(params: FallbackSnapshotParams): LiveMarketSnapshot {
  return {
    symbol: params.symbol,
    price: null,
    bid: null,
    ask: null,
    volume: null,
    timestamp: params.timestamp ?? null,
    session: params.session,
    stale: true,
    unavailable: true,
    unavailableReason: params.reason,
    currentPrice: null,
  };
}

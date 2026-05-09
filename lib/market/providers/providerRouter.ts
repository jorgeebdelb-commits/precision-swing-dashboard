import type { LiveMarketSnapshot, MarketProviderName } from "@/lib/market/liveQuote";
import { getFinnhubQuote } from "@/lib/market/providers/finnhub";

export async function getQuote(provider: MarketProviderName, symbol: string, now: Date, staleMs: number, lastSuccessAt?: string | null, retryCount?: number): Promise<LiveMarketSnapshot> {
  if (provider === "finnhub") return getFinnhubQuote({ symbol, now, staleMs, lastSuccessAt, retryCount });
  return { symbol, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session: "closed", stale: true, unavailable: true, unavailableReason: "provider_not_implemented", provider, providerState: "offline", retryCount: retryCount ?? 0, providerLatencyMs: null, lastSuccessAt: lastSuccessAt ?? null, lastError: `${provider} provider not implemented`, quotaStatus: null };
}

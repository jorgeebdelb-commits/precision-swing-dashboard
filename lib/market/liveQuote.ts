import { getQuote } from "@/lib/market/providers/providerRouter";

export type MarketSessionState = "regular" | "premarket" | "after-hours" | "closed" | "weekend";
export type MarketProviderName = "finnhub" | "polygon" | "twelvedata" | "alphavantage";
export type MarketProviderState = "online" | "stale" | "offline" | "missing_credentials";

export interface LiveMarketSnapshot {
  symbol: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  timestamp: string | null;
  currentPrice: number | null;
  session: MarketSessionState;
  stale: boolean;
  staleAgeSeconds?: number;
  unavailable: boolean;
  unavailableReason?: string;
  provider: string;
  providerState?: MarketProviderState;
  providerLatencyMs?: number | null;
  quotaStatus?: string | null;
  retryCount?: number;
  lastSuccessAt?: string | null;
  lastError?: string | null;
}

const STALE_MS = 15 * 60 * 1000;
const lastSuccessBySymbol = new Map<string, string>();
const lastErrorBySymbol = new Map<string, string>();
const retryBySymbol = new Map<string, number>();

function getSession(now: Date): MarketSessionState {
  const day = now.getUTCDay();
  if (day === 0 || day === 6) return "weekend";
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minutes >= 810 && minutes < 1200) return "regular";
  if (minutes >= 570 && minutes < 810) return "premarket";
  if (minutes >= 1200 && minutes < 1440) return "after-hours";
  return "closed";
}

export async function getLiveQuote(symbol: string): Promise<LiveMarketSnapshot> {
  const normalized = symbol.trim().toUpperCase();
  const now = new Date();
  const session = getSession(now);
  const provider: MarketProviderName = "finnhub";

  try {
    const snapshot = await getQuote(provider, normalized, now, STALE_MS, lastSuccessBySymbol.get(normalized) ?? null, retryBySymbol.get(normalized) ?? 0);
    const merged = { ...snapshot, session };
    if (snapshot.price != null && snapshot.price > 0 && !snapshot.stale) {
      lastSuccessBySymbol.set(normalized, snapshot.timestamp ?? now.toISOString());
      retryBySymbol.set(normalized, 0);
      lastErrorBySymbol.delete(normalized);
    } else {
      retryBySymbol.set(normalized, (retryBySymbol.get(normalized) ?? 0) + 1);
      if (snapshot.lastError) lastErrorBySymbol.set(normalized, snapshot.lastError);
    }
    return { ...merged, lastError: merged.lastError ?? lastErrorBySymbol.get(normalized) ?? null, retryCount: retryBySymbol.get(normalized) ?? 0 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Live quote fetch failed";
    retryBySymbol.set(normalized, (retryBySymbol.get(normalized) ?? 0) + 1);
    lastErrorBySymbol.set(normalized, message);
    return { symbol: normalized, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session, stale: true, unavailable: true, unavailableReason: "Live quote fetch failed", provider, providerState: "offline", providerLatencyMs: null, quotaStatus: null, retryCount: retryBySymbol.get(normalized) ?? 0, lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? null, lastError: message };
  }
}

import { normalizeSymbolInput, type NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";
import { routeBattlefield } from "@/lib/intelligence/router/battlefieldRouter";
import { getLiveQuote } from "@/lib/market/liveQuote";
import { createFallbackSnapshot } from "@/lib/market/fallbackSnapshot";
import type { BattlefieldApiResponse } from "@/lib/intelligence/types/battlefield";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_TABLE } from "@/lib/watchlist/schema";

const lastValidBySymbol = new Map<string, number>();
const MEGACAP_MIN = 0.5;

function sanityMax(symbol: string): number {
  if (["MSFT", "AAPL", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"].includes(symbol)) return 2000;
  return 10000;
}

function quoteIntegrity(symbol: string, price: number): { valid: boolean; score: number; suspect: boolean } {
  const prev = lastValidBySymbol.get(symbol);
  if (!Number.isFinite(price) || price <= 0) return { valid: false, score: 0, suspect: true };
  if (price < MEGACAP_MIN && ["MSFT", "AAPL", "NVDA", "AMZN", "META", "GOOGL", "TSLA", "AMD"].includes(symbol)) return { valid: false, score: 5, suspect: true };
  if (price > sanityMax(symbol)) return { valid: false, score: 8, suspect: true };
  if (prev && Math.abs(price - prev) / prev > 0.35) return { valid: false, score: 15, suspect: true };
  return { valid: true, score: 100, suspect: false };
}

export async function getWatchlistSymbols(): Promise<string[]> { const supabase = getSupabaseServerClient(); const { data } = await supabase.from(WATCHLIST_TABLE).select("symbol").order("created_at", { ascending: true }); return (data ?? []).map((row: { symbol: string }) => row.symbol).filter(Boolean); }

async function buildInput(symbol: string): Promise<NormalizedSymbolInput> {
  try {
    const live = await getLiveQuote(symbol);
    const rawPrice = typeof live.price === "number" && live.price > 0 ? live.price : 0;
    const integrity = quoteIntegrity(symbol, rawPrice);
    const price = integrity.valid ? rawPrice : 0;
    if (integrity.valid) lastValidBySymbol.set(symbol, rawPrice);
    const spread = typeof live.bid === "number" && typeof live.ask === "number" ? Math.max(0, live.ask - live.bid) : Math.max(price * 0.003, 0.01);
    const support = Math.max(0.01, price - Math.max(spread * 4, price * 0.015));
    const resistance = price + Math.max(spread * 4, price * 0.015);

    return normalizeSymbolInput({ symbol, price, priceTimestamp: live.timestamp ?? null, marketDataState: price > 0 ? (live.stale ? "cached" : "live") : "offline", staleData: live.stale || price <= 0, quoteProvider: live.provider, lastQuoteSuccessAt: live.lastSuccessAt ?? null, lastQuoteError: integrity.valid ? (live.lastError ?? live.unavailableReason ?? null) : "Suspect quote rejected", providerLatencyMs: live.providerLatencyMs ?? null, quoteRetryCount: live.retryCount ?? 0, staleAgeSeconds: live.staleAgeSeconds ?? null, quoteQuotaStatus: live.quotaStatus ?? null, support, resistance, lr50: price, lr100: price, vwap: price, rsi: 50, atrPercent: price > 0 ? (Math.max(0.01, resistance - support) / price) * 100 : 0, volumeRatio: 1, volume: live.volume ?? 0, technicalScore: 6.5, fundamentalsScore: 6.2, macroScore: 5.8, politicalScore: 5.5, sentimentScore: 5.9, flowScore: 5.7, quoteIntegrityScore: integrity.score, quoteSuspect: integrity.suspect });
  } catch {
    const fallback = createFallbackSnapshot({ symbol, session: "closed", reason: "buildInput failed" });
    return normalizeSymbolInput({ symbol, price: 0, priceTimestamp: fallback.timestamp ?? null, marketDataState: "offline", staleData: true, support: 0.01, resistance: 0.02, lr50: 0, lr100: 0, vwap: 0, rsi: 50, atrPercent: 3, volumeRatio: 1, volume: 0, technicalScore: 5, fundamentalsScore: 5, macroScore: 5, politicalScore: 5, sentimentScore: 5, flowScore: 5 });
  }
}

export interface GetIntelligenceConfig { symbols: string[]; force?: boolean; horizon?: string; }
export async function getIntelligence({ symbols }: GetIntelligenceConfig): Promise<BattlefieldApiResponse> {
  const settled = await Promise.allSettled(symbols.map((symbol) => buildInput(symbol.toUpperCase())));
  const inputs = settled.filter((item): item is PromiseFulfilledResult<NormalizedSymbolInput> => item.status === "fulfilled").map((item) => item.value);
  return { items: inputs.map((input) => routeBattlefield(input)), generatedAt: new Date().toISOString(), source: "fresh" };
}

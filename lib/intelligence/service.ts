import { normalizeSymbolInput, type NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";
import { routeBattlefield } from "@/lib/intelligence/router/battlefieldRouter";
import { getLiveQuote } from "@/lib/market/liveQuote";
import type { BattlefieldApiResponse } from "@/lib/intelligence/types/battlefield";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_TABLE } from "@/lib/watchlist/schema";

export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from(WATCHLIST_TABLE).select("symbol").order("created_at", { ascending: true });
  const symbols = (data ?? []).map((row: { symbol: string }) => row.symbol).filter(Boolean);
  console.log("[watchlist] symbols from db:", symbols);
  return symbols;
}

async function buildInput(symbol: string): Promise<NormalizedSymbolInput> {
  const live = await getLiveQuote(symbol);
  if (live.unavailable || live.price == null || live.price <= 0) {
    throw new Error(`Live market data unavailable for ${symbol}`);
  }

  const price = live.price;
  const spread = live.bid != null && live.ask != null ? Math.max(0, live.ask - live.bid) : price * 0.003;
  const support = Math.max(0.01, price - Math.max(spread * 4, price * 0.015));
  const resistance = price + Math.max(spread * 4, price * 0.015);

  return normalizeSymbolInput({
    symbol,
    price,
    support,
    resistance,
    lr50: price,
    lr100: price,
    vwap: price,
    rsi: 50,
    atrPercent: (Math.max(0.01, resistance - support) / price) * 100,
    volumeRatio: 1,
    volume: live.volume ?? 0,
    technicalScore: 0,
    fundamentalsScore: 0,
    macroScore: 0,
    politicalScore: 0,
    sentimentScore: 0,
    flowScore: 0,
  });
}

export interface GetIntelligenceConfig {
  symbols: string[];
  force?: boolean;
  horizon?: string;
}

export async function getIntelligence({ symbols }: GetIntelligenceConfig): Promise<BattlefieldApiResponse> {
  console.log("[intelligence] symbols entering getIntelligence:", symbols);
  const inputs = await Promise.all(symbols.map((symbol) => buildInput(symbol.toUpperCase())));
  const items = inputs.map((input) => routeBattlefield(input));
  console.log(
    "[intelligence] battlefield results:",
    items.map((item) => ({
      symbol: item.symbol,
      primaryOpportunity: item.primaryOpportunity,
      deployment: item.deployment.bestDeployment,
    }))
  );
  return {
    items,
    generatedAt: new Date().toISOString(),
    source: "fresh",
  };
}

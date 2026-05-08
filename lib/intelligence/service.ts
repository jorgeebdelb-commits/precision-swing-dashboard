import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_TABLE } from "@/lib/watchlist/schema";
import { routeBattlefield } from "@/lib/intelligence/router/battlefieldRouter";
import type { BattlefieldApiResponse, SymbolInput } from "@/lib/intelligence/types/battlefield";

export async function getWatchlistSymbols(): Promise<string[]> {
  const supabase = getSupabaseServerClient();
  const { data } = await supabase.from(WATCHLIST_TABLE).select("symbol").order("created_at", { ascending: true });
  const symbols = (data ?? []).map((row: { symbol: string }) => row.symbol).filter(Boolean);
  console.log("[watchlist] symbols from db:", symbols);
  return symbols;
}

function buildInput(symbol: string): SymbolInput {
  const seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 80 + (seed % 120);
  const support = base * 0.95;
  const resistance = base * 1.05;
  const technicalScore = 4.5 + (seed % 40) / 10;
  return {
    symbol,
    price: base,
    support,
    resistance,
    lr50: base * (1 + ((seed % 9) - 4) / 100),
    lr100: base,
    vwap: base * 0.995,
    rsi: 38 + (seed % 38),
    atrPercent: 2 + (seed % 55) / 10,
    volumeRatio: 0.8 + (seed % 15) / 10,
    technicalScore,
    fundamentalsScore: 4.2 + (seed % 45) / 10,
    macroScore: 4 + (seed % 40) / 10,
    politicalScore: 4 + (seed % 35) / 10,
    sentimentScore: 4 + (seed % 50) / 10,
    flowScore: 4 + (seed % 45) / 10,
  };
}

export interface GetIntelligenceConfig {
  symbols: string[];
  force?: boolean;
  horizon?: string;
}

export async function getIntelligence({ symbols }: GetIntelligenceConfig): Promise<BattlefieldApiResponse> {
  console.log("[intelligence] symbols entering getIntelligence:", symbols);
  const items = symbols.map((symbol) => routeBattlefield(buildInput(symbol.toUpperCase())));
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

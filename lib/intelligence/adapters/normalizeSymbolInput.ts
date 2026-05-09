import { safeNumber } from "@/lib/intelligence/utils/safeNumber";

export interface NormalizedSymbolInput {
  symbol: string;
  price: number;
  priceTimestamp?: string | null;
  marketDataState?: "live" | "cached" | "offline";
  staleData?: boolean;
  quoteProvider?: string;
  lastQuoteSuccessAt?: string | null;
  lastQuoteError?: string | null;
  providerLatencyMs?: number | null;
  quoteRetryCount?: number | null;
  staleAgeSeconds?: number | null;
  quoteQuotaStatus?: string | null;
  quoteIntegrityScore?: number;
  quoteSuspect?: boolean;
  technicalScore: number;
  fundamentalsScore: number;
  macroScore: number;
  sentimentScore: number;
  whaleScore: number;
  volume: number;
  rsi: number;
  volatility: number;
  sector?: string;
  support: number;
  resistance: number;
  lr50: number;
  lr100: number;
  vwap: number;
  atrPercent: number;
  volumeRatio: number;
  politicalScore: number;
  flowScore: number;
}

type RawSymbolInput = Partial<Record<keyof NormalizedSymbolInput, unknown>> & {
  symbol?: unknown;
};

export function normalizeSymbolInput(input: RawSymbolInput): NormalizedSymbolInput {
  const symbol = typeof input.symbol === "string" ? input.symbol.toUpperCase() : "UNKNOWN";
  return {
    symbol,
    price: safeNumber(input.price),
    priceTimestamp: typeof input.priceTimestamp === "string" ? input.priceTimestamp : null,
    marketDataState: input.marketDataState === "live" || input.marketDataState === "cached" || input.marketDataState === "offline" ? input.marketDataState : "offline",
    staleData: typeof input.staleData === "boolean" ? input.staleData : true,
    quoteProvider: typeof input.quoteProvider === "string" ? input.quoteProvider : "Unknown",
    lastQuoteSuccessAt: typeof input.lastQuoteSuccessAt === "string" ? input.lastQuoteSuccessAt : null,
    lastQuoteError: typeof input.lastQuoteError === "string" ? input.lastQuoteError : null,
    providerLatencyMs: safeNumber(input.providerLatencyMs, null),
    quoteRetryCount: safeNumber(input.quoteRetryCount),
    staleAgeSeconds: safeNumber(input.staleAgeSeconds, null),
    quoteQuotaStatus: typeof input.quoteQuotaStatus === "string" ? input.quoteQuotaStatus : null,
    quoteIntegrityScore: safeNumber(input.quoteIntegrityScore),
    quoteSuspect: Boolean(input.quoteSuspect),
    technicalScore: safeNumber(input.technicalScore),
    fundamentalsScore: safeNumber(input.fundamentalsScore),
    macroScore: safeNumber(input.macroScore),
    sentimentScore: safeNumber(input.sentimentScore),
    whaleScore: safeNumber(input.whaleScore, safeNumber(input.flowScore)),
    volume: safeNumber(input.volume, safeNumber(input.volumeRatio)),
    rsi: safeNumber(input.rsi),
    volatility: safeNumber(input.volatility, safeNumber(input.atrPercent)),
    sector: typeof input.sector === "string" ? input.sector : undefined,
    support: safeNumber(input.support),
    resistance: safeNumber(input.resistance),
    lr50: safeNumber(input.lr50),
    lr100: safeNumber(input.lr100),
    vwap: safeNumber(input.vwap),
    atrPercent: safeNumber(input.atrPercent),
    volumeRatio: safeNumber(input.volumeRatio),
    politicalScore: safeNumber(input.politicalScore),
    flowScore: safeNumber(input.flowScore, safeNumber(input.whaleScore)),
  };
}

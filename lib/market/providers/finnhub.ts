import type { LiveMarketSnapshot } from "@/lib/market/liveQuote";

interface FinnhubQuoteResponse { c?: number; h?: number; l?: number; o?: number; pc?: number; t?: number; a?: number; b?: number; }

export interface ProviderFetchContext {
  symbol: string;
  now: Date;
  staleMs: number;
  lastSuccessAt?: string | null;
  retryCount?: number;
}

function logRaw(symbol: string, url: string, status: number, payload: unknown) {
  console.log(`[MARKET] provider=finnhub symbol=${symbol} status=${status} url=${url} timestamp=${new Date().toISOString()} payload=${JSON.stringify(payload)}`);
}

export async function getFinnhubQuote(ctx: ProviderFetchContext): Promise<LiveMarketSnapshot> {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    console.error("[MARKET] provider=finnhub state=missing_credentials missing FINNHUB_API_KEY");
    return { symbol: ctx.symbol, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session: "closed", stale: true, unavailable: true, unavailableReason: "missing_credentials", provider: "finnhub", providerState: "missing_credentials", retryCount: ctx.retryCount ?? 0, providerLatencyMs: null, lastSuccessAt: ctx.lastSuccessAt ?? null, lastError: "Missing FINNHUB_API_KEY", quotaStatus: null };
  }

  const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(ctx.symbol)}&token=${apiKey}`;
  const startedAt = Date.now();
  const response = await fetch(quoteUrl, { cache: "no-store" });
  let payload: unknown = null;
  try { payload = await response.json(); } catch { payload = null; }
  const latency = Date.now() - startedAt;
  logRaw(ctx.symbol, quoteUrl, response.status, payload);

  if (!response.ok) {
    return { symbol: ctx.symbol, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session: "closed", stale: true, unavailable: true, unavailableReason: `provider_http_${response.status}`, provider: "finnhub", providerState: "offline", retryCount: (ctx.retryCount ?? 0) + 1, providerLatencyMs: latency, lastSuccessAt: ctx.lastSuccessAt ?? null, lastError: `Quote provider request failed (${response.status})`, quotaStatus: response.status === 429 ? "rate_limited" : null };
  }

  const quote = payload as FinnhubQuoteResponse | null;
  const rawPrice = Number(quote?.c);
  const hasInvalidShape = !quote || !Number.isFinite(rawPrice) || rawPrice <= 0 || quote.c == null;
  if (hasInvalidShape) {
    return { symbol: ctx.symbol, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session: "closed", stale: true, unavailable: true, unavailableReason: "invalid_provider_payload", provider: "finnhub", providerState: "offline", retryCount: (ctx.retryCount ?? 0) + 1, providerLatencyMs: latency, lastSuccessAt: ctx.lastSuccessAt ?? null, lastError: "No valid Finnhub quote price", quotaStatus: null };
  }

  const quoteTsMs = Number(quote?.t) > 0 ? Number(quote?.t) * 1000 : ctx.now.getTime();
  const staleAgeSeconds = Math.max(0, Math.floor((ctx.now.getTime() - quoteTsMs) / 1000));
  const stale = staleAgeSeconds * 1000 > ctx.staleMs;

  return { symbol: ctx.symbol, price: rawPrice, currentPrice: rawPrice, bid: Number.isFinite(Number(quote?.b)) ? Number(quote?.b) : null, ask: Number.isFinite(Number(quote?.a)) ? Number(quote?.a) : null, volume: null, timestamp: new Date(quoteTsMs).toISOString(), session: "closed", stale, staleAgeSeconds, unavailable: stale, unavailableReason: stale ? "stale_quote" : undefined, provider: "finnhub", providerState: stale ? "stale" : "online", retryCount: 0, providerLatencyMs: latency, lastSuccessAt: new Date(quoteTsMs).toISOString(), lastError: null, quotaStatus: null };
}

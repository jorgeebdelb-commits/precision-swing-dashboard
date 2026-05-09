export type MarketSessionState = "regular" | "premarket" | "after-hours" | "closed" | "weekend";

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
  unavailable: boolean;
  unavailableReason?: string;
  provider: string;
  lastSuccessAt?: string | null;
  lastError?: string | null;
}

const STALE_MS = 15 * 60 * 1000;
const staleQuoteCache = new Map<string, LiveMarketSnapshot>();
const lastSuccessBySymbol = new Map<string, string>();
const lastErrorBySymbol = new Map<string, string>();

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
  console.log("[LIVE SNAPSHOT] request", symbol);
  const normalized = symbol.trim().toUpperCase();
  const now = new Date();
  const session = getSession(now);
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.warn("[LIVE SNAPSHOT] Missing FINNHUB_API_KEY for", normalized);
    const error = "Missing FINNHUB_API_KEY";
    lastErrorBySymbol.set(normalized, error);
    return { symbol: normalized, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session, stale: true, unavailable: true, unavailableReason: error, provider: "Finnhub", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? null, lastError: error };
  }

  try {
    const quoteUrl = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(normalized)}&token=${apiKey}`;
    const candleFrom = Math.floor(now.getTime() / 1000) - 60 * 60 * 8;
    const candleTo = Math.floor(now.getTime() / 1000);
    const candleUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(normalized)}&resolution=1&from=${candleFrom}&to=${candleTo}&token=${apiKey}`;

    const [quoteResponse, candleResponse] = await Promise.all([fetch(quoteUrl, { cache: "no-store" }), fetch(candleUrl, { cache: "no-store" })]);

    if (!quoteResponse.ok || !candleResponse.ok) {
      console.error("[LIVE SNAPSHOT] provider request failed", normalized, quoteResponse.status, candleResponse.status);
      const error = `Quote provider request failed (${quoteResponse.status}/${candleResponse.status})`;
      lastErrorBySymbol.set(normalized, error);
      return { symbol: normalized, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session, stale: true, unavailable: true, unavailableReason: error, provider: "Finnhub", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? null, lastError: error };
    }

    const quote = await quoteResponse.json();
    const candle = await candleResponse.json();
    console.log("[QUOTE RAW]", normalized, quote);

    const rawPrice = Number(quote?.c ?? quote?.price ?? quote?.last ?? quote?.lastPrice);
    const quoteTsMs = Number(quote?.t) > 0 ? Number(quote.t) * 1000 : 0;
    const candleVolumes = Array.isArray(candle?.v) ? candle.v : [];
    const latestVolume = candleVolumes.length > 0 ? Number(candleVolumes[candleVolumes.length - 1]) : null;
    const timestamp = quoteTsMs > 0 ? new Date(quoteTsMs) : now;
    const stale = now.getTime() - timestamp.getTime() > STALE_MS;

    if (!Number.isFinite(rawPrice) || rawPrice <= 0) {
      console.warn("[LIVE SNAPSHOT] invalid live price", normalized, quote);
      const cached = staleQuoteCache.get(normalized);
      if (cached && typeof cached.price === "number" && cached.price > 0) return { ...cached, stale: true, unavailable: false, unavailableReason: "Using stale cached quote", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? cached.lastSuccessAt ?? cached.timestamp ?? null, lastError: "No live last-trade price" };
      const error = "No live last-trade price";
      lastErrorBySymbol.set(normalized, error);
      return { symbol: normalized, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: timestamp.toISOString(), session, stale: true, unavailable: true, unavailableReason: error, provider: "Finnhub", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? null, lastError: error };
    }

    const snapshot = {
      symbol: normalized,
      price: rawPrice,
      currentPrice: rawPrice,
      bid: Number.isFinite(Number(quote?.b)) && Number(quote.b) > 0 ? Number(quote.b) : null,
      ask: Number.isFinite(Number(quote?.a)) && Number(quote.a) > 0 ? Number(quote.a) : null,
      volume: Number.isFinite(latestVolume) && latestVolume !== null ? latestVolume : null,
      timestamp: timestamp.toISOString(),
      session,
      stale,
      unavailable: stale && session !== "regular",
      unavailableReason: stale ? "Live quote is stale" : undefined,
      provider: "Finnhub",
      lastSuccessAt: timestamp.toISOString(),
      lastError: null,
    };
    lastSuccessBySymbol.set(normalized, timestamp.toISOString());
    lastErrorBySymbol.delete(normalized);
    staleQuoteCache.set(normalized, snapshot);
    console.log("[LIVE SNAPSHOT]", normalized, snapshot);
    return snapshot;
  } catch (error) {
    console.error("[LIVE SNAPSHOT] fetch failed", normalized, error);
    const cached = staleQuoteCache.get(normalized);
    const message = error instanceof Error ? error.message : "Live quote fetch failed";
    lastErrorBySymbol.set(normalized, message);
    if (cached && typeof cached.price === "number" && cached.price > 0) return { ...cached, stale: true, unavailable: false, unavailableReason: "Using stale cached quote", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? cached.lastSuccessAt ?? cached.timestamp ?? null, lastError: message };
    return { symbol: normalized, price: null, currentPrice: null, bid: null, ask: null, volume: null, timestamp: null, session, stale: true, unavailable: true, unavailableReason: "Live quote fetch failed", provider: "Finnhub", lastSuccessAt: lastSuccessBySymbol.get(normalized) ?? null, lastError: message };
  }
}

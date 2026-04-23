import { NextResponse } from "next/server";

function getSession() {
  const now = new Date();
  const hour = now.getUTCHours();

  if (hour >= 13 && hour < 20) return "Regular";
  if (hour >= 9 && hour < 13) return "Premarket";
  if (hour >= 20 && hour < 24) return "After Hours";

  return "Closed";
}

function getTrend(price: number, open: number, high: number, low: number) {
  if (price >= high * 0.995) return "Near Day High";
  if (price <= low * 1.005) return "Near Day Low";
  if (price > open) return "Bullish Intraday";
  if (price < open) return "Weak Intraday";
  return "Flat";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
    }

    const apiKey = process.env.FINNHUB_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing FINNHUB_API_KEY" },
        { status: 500 }
      );
    }

    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const txt = await response.text();

      return NextResponse.json(
        {
          error: "Quote request failed",
          details: txt,
        },
        { status: 502 }
      );
    }

    const data = await response.json();

    const price = data.c ?? 0;
    const change = data.d ?? 0;
    const percentChange = data.dp ?? 0;
    const high = data.h ?? 0;
    const low = data.l ?? 0;
    const open = data.o ?? 0;
    const previousClose = data.pc ?? 0;
    const timestamp = data.t ?? 0;

    const staleSeconds = Math.floor(Date.now() / 1000) - timestamp;

    const stale = staleSeconds > 900;

    const trend = getTrend(price, open, high, low);

    const rangePct =
      high && low ? (((high - low) / low) * 100).toFixed(2) : "0";

    return NextResponse.json({
      symbol,
      price,
      change,
      percentChange,
      high,
      low,
      open,
      previousClose,
      timestamp,
      stale,
      session: getSession(),
      trend,
      dayRangePercent: Number(rangePct),
    });
  } catch {
    return NextResponse.json(
      { error: "Unexpected server error in quote route" },
      { status: 500 }
    );
  }
}
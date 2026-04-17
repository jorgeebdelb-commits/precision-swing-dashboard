import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

console.log("FINNHUB_API_KEY loaded:", !!apiKey);

if (!apiKey) {
  return NextResponse.json({ error: "Missing FINNHUB_API_KEY" }, { status: 500 });
}

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(
    symbol
  )}&token=${apiKey}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
  const errorText = await response.text();
  console.log("FINNHUB QUOTE ERROR:", response.status, errorText);

  return NextResponse.json(
    {
      error: "Finnhub quote request failed",
      status: response.status,
      details: errorText,
    },
    { status: 502 }
  );
}
  const data = await response.json();

  return NextResponse.json({
    symbol,
    price: data.c ?? 0,
    change: data.d ?? 0,
    percentChange: data.dp ?? 0,
    high: data.h ?? 0,
    low: data.l ?? 0,
    open: data.o ?? 0,
    previousClose: data.pc ?? 0,
    timestamp: data.t ?? 0,
  });
}
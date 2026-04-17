import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");

  if (!symbol) {
    return NextResponse.json({ error: "Missing symbol" }, { status: 400 });
  }

  const apiKey = process.env.FINNHUB_API_KEY;

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();

  const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${from
    .toISOString()
    .split("T")[0]}&to=${to
    .toISOString()
    .split("T")[0]}&token=${apiKey}`;

  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return NextResponse.json(
      { error: "Finnhub sentiment failed" },
      { status: 502 }
    );
  }

  const news = await response.json();

  // Simple sentiment score (basic version)
  const sentimentScore = news.length;

  return NextResponse.json({
    symbol,
    sentimentScore,
    newsCount: news.length,
  });
}
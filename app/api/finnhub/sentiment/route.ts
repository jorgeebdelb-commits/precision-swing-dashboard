import { NextResponse } from "next/server";

const positiveMap: Record<string, number> = {
  beat: 3,
  beats: 3,
  upgrade: 4,
  upgraded: 4,
  bullish: 4,
  surge: 5,
  strong: 2,
  growth: 3,
  record: 4,
  profit: 3,
  profits: 3,
  buyback: 4,
  partnership: 4,
  expansion: 3,
  demand: 2,
  outperform: 4,
  rebound: 2,
  momentum: 2,
};

const negativeMap: Record<string, number> = {
  miss: -4,
  misses: -4,
  downgrade: -5,
  downgraded: -5,
  bearish: -4,
  weak: -3,
  lawsuit: -5,
  probe: -4,
  investigation: -5,
  cut: -3,
  cuts: -3,
  decline: -3,
  loss: -4,
  losses: -4,
  delay: -3,
  warning: -5,
  risk: -2,
  pressure: -2,
};

function sourceBoost(source: string): number {
  const s = source.toLowerCase();

  if (s.includes("reuters")) return 1.4;
  if (s.includes("bloomberg")) return 1.4;
  if (s.includes("cnbc")) return 1.2;
  if (s.includes("marketwatch")) return 1.1;

  return 1.0;
}

function recencyBoost(datetime: number): number {
  const now = Date.now() / 1000;
  const ageHours = (now - datetime) / 3600;

  if (ageHours < 6) return 1.4;
  if (ageHours < 24) return 1.25;
  if (ageHours < 72) return 1.1;
  return 1.0;
}

function scoreHeadline(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word in positiveMap) {
    if (lower.includes(word)) score += positiveMap[word];
  }

  for (const word in negativeMap) {
    if (lower.includes(word)) score += negativeMap[word];
  }

  return score;
}

export async function GET(request: Request) {
  try {
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
      .split("T")[0]}&to=${to.toISOString().split("T")[0]}&token=${apiKey}`;

    const response = await fetch(url, { cache: "no-store" });

    const news = await response.json();
    const items = Array.isArray(news) ? news.slice(0, 25) : [];

    let total = 0;

    const scored = items.map((item: any) => {
      const headline = item.headline || "";
      const source = item.source || "";
      const datetime = item.datetime || 0;

      const base = scoreHeadline(headline);
      const weighted =
        base * sourceBoost(source) * recencyBoost(datetime);

      total += weighted;

      return {
        headline,
        source,
        score: Number(weighted.toFixed(2)),
      };
    });

    const sentimentScore = Math.max(
      0,
      Math.min(100, Math.round(50 + total))
    );

    const sentimentLabel =
      sentimentScore >= 70
        ? "Bullish"
        : sentimentScore <= 35
        ? "Bearish"
        : "Neutral";

    return NextResponse.json({
      symbol,
      sentimentScore,
      sentimentLabel,
      rawScore: total,
      newsCount: items.length,
      topHeadlines: scored.slice(0, 5),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Sentiment route failed" },
      { status: 500 }
    );
  }
}
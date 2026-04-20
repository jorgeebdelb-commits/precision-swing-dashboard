import { NextResponse } from "next/server";

const positiveWords = [
  "beat",
  "beats",
  "upgrade",
  "upgraded",
  "bullish",
  "surge",
  "strong",
  "growth",
  "record",
  "profit",
  "profits",
  "buyback",
  "partnership",
  "expands",
  "expansion",
  "demand",
  "outperform",
  "wins",
  "win",
  "rebound",
  "momentum",
];

const negativeWords = [
  "miss",
  "misses",
  "downgrade",
  "downgraded",
  "bearish",
  "drop",
  "drops",
  "weak",
  "lawsuit",
  "probe",
  "investigation",
  "cuts",
  "cut",
  "decline",
  "loss",
  "losses",
  "delay",
  "warning",
  "risk",
  "risks",
  "pressure",
];

function scoreHeadline(text: string): number {
  const lower = text.toLowerCase();
  let score = 0;

  for (const word of positiveWords) {
    if (lower.includes(word)) score += 1;
  }

  for (const word of negativeWords) {
    if (lower.includes(word)) score -= 1;
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

    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing FINNHUB_API_KEY" },
        { status: 500 }
      );
    }

    const from = new Date();
    from.setDate(from.getDate() - 7);

    const to = new Date();

    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
      symbol
    )}&from=${from.toISOString().split("T")[0]}&to=${
      to.toISOString().split("T")[0]
    }&token=${apiKey}`;

    const response = await fetch(url, { cache: "no-store" });

    if (!response.ok) {
      const errorText = await response.text();

      return NextResponse.json(
        {
          error: "Finnhub sentiment failed",
          status: response.status,
          details: errorText,
        },
        { status: 502 }
      );
    }

    const news = await response.json();
    const newsItems = Array.isArray(news) ? news : [];

    const scored = newsItems.slice(0, 20).map((item: any) => {
      const headline = String(item?.headline ?? "");
      return {
        headline,
        score: scoreHeadline(headline),
      };
    });

    const rawScore = scored.reduce((sum, item) => sum + item.score, 0);

    const sentimentScore = Math.max(
      0,
      Math.min(100, 50 + rawScore * 5 + Math.min(newsItems.length, 10))
    );

    const sentimentLabel =
      sentimentScore >= 65
        ? "Bullish"
        : sentimentScore <= 40
        ? "Bearish"
        : "Neutral";

    return NextResponse.json({
      symbol,
      sentimentScore,
      sentimentLabel,
      newsCount: newsItems.length,
      rawScore,
      topHeadlines: scored.slice(0, 5),
    });
  } catch (error) {
    console.error("SENTIMENT ROUTE ERROR:", error);

    return NextResponse.json(
      { error: "Unexpected server error in sentiment route" },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";

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

    // Basic activity proxy, not true NLP sentiment
    const sentimentScore = newsItems.length;

    return NextResponse.json({
      symbol,
      sentimentScore,
      newsCount: newsItems.length,
    });
  } catch (error) {
    console.error("SENTIMENT ROUTE ERROR:", error);

    return NextResponse.json(
      { error: "Unexpected server error in sentiment route" },
      { status: 500 }
    );
  }
}
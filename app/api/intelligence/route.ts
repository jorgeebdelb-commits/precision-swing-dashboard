import { NextResponse } from "next/server";
import { getIntelligence, getWatchlistSymbols } from "@/lib/intelligence/service";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const symbolsParam = url.searchParams.get("symbols");
    const symbols = symbolsParam
      ? symbolsParam
          .split(",")
          .map((symbol) => symbol.trim().toUpperCase())
          .filter(Boolean)
      : await getWatchlistSymbols();

    const result = await getIntelligence(symbols, false);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load intelligence";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

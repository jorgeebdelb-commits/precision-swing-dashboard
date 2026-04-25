import { NextResponse } from "next/server";
import { getIntelligence, getWatchlistSymbols } from "@/lib/intelligence/service";
import type { RefreshIntelligenceRequest } from "@/types/intelligence";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as RefreshIntelligenceRequest;

    const symbols = body.symbols?.length
      ? body.symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean)
      : await getWatchlistSymbols();

    const result = await getIntelligence(symbols, body.force ?? true, body.horizon);

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh intelligence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

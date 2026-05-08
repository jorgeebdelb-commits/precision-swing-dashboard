import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { WATCHLIST_TABLE } from "@/lib/watchlist/schema";

export async function DELETE(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol")?.trim().toUpperCase();

  if (!symbol) {
    return NextResponse.json({ error: "Ticker symbol is required." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from(WATCHLIST_TABLE).delete().eq("symbol", symbol);

  if (error) {
    return NextResponse.json({ error: "Failed to remove symbol from watchlist." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, symbol });
}

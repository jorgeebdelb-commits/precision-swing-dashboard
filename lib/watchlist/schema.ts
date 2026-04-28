import type { Bias } from "@/app/lib/watchlist";

export const WATCHLIST_TABLE = "watchlist" as const;

export const WATCHLIST_COLUMNS = {
  id: "id",
  symbol: "symbol",
  createdAt: "created_at",
  bias: "bias",
  notes: "notes",
} as const;

export type WatchlistRow = {
  id: string;
  symbol: string;
  created_at: string;
  bias: Bias;
  notes: string[];
};

export type WatchlistInsert = {
  symbol: string;
  bias: Bias;
  notes?: string[];
};

export type WatchlistUpdate = Partial<WatchlistInsert>;

export const WATCHLIST_SELECT_COLUMNS = [
  WATCHLIST_COLUMNS.id,
  WATCHLIST_COLUMNS.symbol,
  WATCHLIST_COLUMNS.createdAt,
  WATCHLIST_COLUMNS.bias,
  WATCHLIST_COLUMNS.notes,
] as const;

export const WATCHLIST_SELECT = WATCHLIST_SELECT_COLUMNS.join(", ");

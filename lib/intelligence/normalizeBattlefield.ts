export type SafeBattlefieldRow = {
  symbol: string;
  swing: { bias: string };
  longTerm: { bias: string };
  whale: { bias: string };
  macro: { bias: string };
  politics: { bias: string };
  sentiment: { bias: string };
  deployment: { bestDeployment: string };
  warnings: string[];
};

function toSafeRow(raw: unknown): SafeBattlefieldRow {
  const row = (raw ?? {}) as Record<string, any>;
  return {
    symbol: typeof row.symbol === "string" ? row.symbol : "UNKNOWN",
    swing: { bias: row?.swing?.bias ?? "No Trade" },
    longTerm: { bias: row?.longTerm?.bias ?? "No Trade" },
    whale: { bias: row?.whale?.bias ?? "Neutral" },
    macro: { bias: row?.macro?.bias ?? "Neutral" },
    politics: { bias: row?.politics?.bias ?? "Neutral" },
    sentiment: { bias: row?.sentiment?.bias ?? "Neutral" },
    deployment: { bestDeployment: row?.deployment?.bestDeployment ?? "Watch Only" },
    warnings: Array.isArray(row?.warnings)
      ? row.warnings.map((x: unknown) => String(x ?? "")).filter(Boolean)
      : [],
  };
}

export function normalizeBattlefieldRows(input: unknown): SafeBattlefieldRow[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(toSafeRow);
  if (Array.isArray((input as any).rows)) return (input as any).rows.map(toSafeRow);
  if (Array.isArray((input as any).battlefield)) return (input as any).battlefield.map(toSafeRow);
  if (Array.isArray((input as any).results)) return (input as any).results.map(toSafeRow);
  return [];
}

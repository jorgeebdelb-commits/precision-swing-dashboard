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
  const row = (raw ?? {}) as Record<string, unknown>;
  const nested = (key: string) => {
    const value = row[key];
    return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
  };

  const swing = nested("swing");
  const longTerm = nested("longTerm");
  const whale = nested("whale");
  const macro = nested("macro");
  const politics = nested("politics");
  const sentiment = nested("sentiment");
  const deployment = nested("deployment");

  return {
    symbol: typeof row.symbol === "string" ? row.symbol : "UNKNOWN",
    swing: { bias: typeof swing.bias === "string" ? swing.bias : "No Trade" },
    longTerm: { bias: typeof longTerm.bias === "string" ? longTerm.bias : "No Trade" },
    whale: { bias: typeof whale.bias === "string" ? whale.bias : "Neutral" },
    macro: { bias: typeof macro.bias === "string" ? macro.bias : "Neutral" },
    politics: { bias: typeof politics.bias === "string" ? politics.bias : "Neutral" },
    sentiment: { bias: typeof sentiment.bias === "string" ? sentiment.bias : "Neutral" },
    deployment: { bestDeployment: typeof deployment.bestDeployment === "string" ? deployment.bestDeployment : "Watch Only" },
    warnings: Array.isArray(row.warnings) ? row.warnings.map((x) => String(x ?? "")).filter(Boolean) : [],
  };
}

export function normalizeBattlefieldRows(input: unknown): SafeBattlefieldRow[] {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(toSafeRow);

  if (typeof input === "object" && input !== null) {
    const source = input as Record<string, unknown>;

    if (Array.isArray(source.items)) return source.items.map(toSafeRow);
    if (Array.isArray(source.rows)) return source.rows.map(toSafeRow);
    if (Array.isArray(source.results)) return source.results.map(toSafeRow);
    if (Array.isArray(source.battlefield)) return source.battlefield.map(toSafeRow);
  }

  return [];
}

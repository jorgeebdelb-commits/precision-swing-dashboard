import type { HorizonKey } from "@/lib/intelligence/types";

const SYMBOL_POLITICAL_BIAS: Record<string, number> = {
  TSLA: 1.15,
  NVDA: 1.12,
  AMD: 1.08,
  MARA: 1.2,
  RIOT: 1.2,
  LMT: 1.15,
};

const SECTOR_BASE: Record<string, number> = {
  Semiconductors: 1.1,
  Energy: 1.08,
  EV: 1.12,
  Defense: 1.16,
  Biotech: 1.14,
  "Crypto Mining": 1.18,
};

const HORIZON_BASE: Record<HorizonKey, number> = {
  swing: 0.7,
  threeMonth: 0.85,
  sixMonth: 1,
  oneYear: 1.15,
};

export function getPoliticalExposure(params: { symbol: string; sector?: string; horizon: HorizonKey }): number {
  const tickerBias = SYMBOL_POLITICAL_BIAS[params.symbol.toUpperCase()] ?? 1;
  const sectorBias = (params.sector ? SECTOR_BASE[params.sector] : undefined) ?? 1;
  return Number((HORIZON_BASE[params.horizon] * tickerBias * sectorBias).toFixed(3));
}

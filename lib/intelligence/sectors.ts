import type { FactorWeight, HorizonKey } from "@/lib/intelligence/types";

const DEFAULT_WEIGHTS: Record<HorizonKey, FactorWeight[]> = {
  swing: [
    { factor: "technicals", weight: 0.22 },
    { factor: "momentum", weight: 0.2 },
    { factor: "volume", weight: 0.15 },
    { factor: "sentiment", weight: 0.13 },
    { factor: "whalesOptions", weight: 0.15 },
    { factor: "nearTermCatalysts", weight: 0.15 },
  ],
  threeMonth: [
    { factor: "earningsTrend", weight: 0.22 },
    { factor: "sectorTrend", weight: 0.18 },
    { factor: "sentiment", weight: 0.14 },
    { factor: "macroPressure", weight: 0.16 },
    { factor: "catalystCalendar", weight: 0.14 },
    { factor: "technicalStructure", weight: 0.16 },
  ],
  sixMonth: [
    { factor: "fundamentals", weight: 0.2 },
    { factor: "sectorTrend", weight: 0.17 },
    { factor: "macroTrend", weight: 0.15 },
    { factor: "earningsQuality", weight: 0.15 },
    { factor: "politicalRegulatoryExposure", weight: 0.13 },
    { factor: "institutionalBehavior", weight: 0.2 },
  ],
  oneYear: [
    { factor: "longTermFundamentals", weight: 0.2 },
    { factor: "industryLeadership", weight: 0.14 },
    { factor: "balanceSheetQuality", weight: 0.14 },
    { factor: "valuationRisk", weight: 0.12 },
    { factor: "macroCycle", weight: 0.14 },
    { factor: "geopoliticalPolicyExposure", weight: 0.13 },
    { factor: "competitiveMoat", weight: 0.13 },
  ],
};

const SECTOR_ADJUSTMENTS: Record<string, Partial<Record<HorizonKey, Record<string, number>>>> = {
  Semiconductors: {
    swing: { nearTermCatalysts: 1.1, sentiment: 1.05 },
    threeMonth: { sectorTrend: 1.15, catalystCalendar: 1.05 },
    sixMonth: { sectorTrend: 1.1, macroTrend: 1.08 },
    oneYear: { geopoliticalPolicyExposure: 1.2, industryLeadership: 1.1 },
  },
  Energy: {
    swing: { sentiment: 1.05, nearTermCatalysts: 1.1 },
    threeMonth: { macroPressure: 1.12, sectorTrend: 1.08 },
    sixMonth: { macroTrend: 1.13, politicalRegulatoryExposure: 1.1 },
    oneYear: { macroCycle: 1.14, geopoliticalPolicyExposure: 1.13 },
  },
  EV: {
    swing: { momentum: 1.08, sentiment: 1.09 },
    threeMonth: { macroPressure: 1.12, sentiment: 1.08 },
    sixMonth: { politicalRegulatoryExposure: 1.12, fundamentals: 1.06 },
    oneYear: { valuationRisk: 1.15, geopoliticalPolicyExposure: 1.08 },
  },
  Defense: {
    threeMonth: { catalystCalendar: 1.1, sectorTrend: 1.06 },
    sixMonth: { politicalRegulatoryExposure: 1.16, institutionalBehavior: 1.08 },
    oneYear: { geopoliticalPolicyExposure: 1.18, industryLeadership: 1.06 },
  },
  Biotech: {
    swing: { nearTermCatalysts: 1.2, sentiment: 1.08 },
    threeMonth: { catalystCalendar: 1.2, earningsTrend: 0.92 },
    sixMonth: { fundamentals: 1.08, politicalRegulatoryExposure: 1.1 },
    oneYear: { balanceSheetQuality: 1.12, valuationRisk: 1.12 },
  },
  "Crypto Mining": {
    swing: { momentum: 1.12, whalesOptions: 1.1 },
    threeMonth: { macroPressure: 1.15, sentiment: 1.06 },
    sixMonth: { macroTrend: 1.14, politicalRegulatoryExposure: 1.16 },
    oneYear: { macroCycle: 1.12, geopoliticalPolicyExposure: 1.16, valuationRisk: 1.12 },
  },
};

function normalize(weights: FactorWeight[]): FactorWeight[] {
  const total = weights.reduce((sum, weight) => sum + weight.weight, 0) || 1;
  return weights.map((weight) => ({ ...weight, weight: Number((weight.weight / total).toFixed(4)) }));
}

export function getSectorFactorWeights(horizon: HorizonKey, sector?: string): FactorWeight[] {
  const base = DEFAULT_WEIGHTS[horizon].map((entry) => ({ ...entry }));
  if (!sector) return base;

  const multipliers = SECTOR_ADJUSTMENTS[sector]?.[horizon];
  if (!multipliers) return base;

  const adjusted = base.map((entry) => ({
    ...entry,
    weight: entry.weight * (multipliers[entry.factor] ?? 1),
  }));

  return normalize(adjusted);
}

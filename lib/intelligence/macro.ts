import type { HorizonKey } from "@/lib/intelligence/types";

export function getMacroContextWeights(horizon: HorizonKey): Record<string, number> {
  if (horizon === "swing") {
    return { fedPolicy: 0.2, dollar: 0.2, yields: 0.25, liquidity: 0.2, riskAppetite: 0.15 };
  }
  if (horizon === "threeMonth") {
    return { fedPolicy: 0.28, inflation: 0.2, labor: 0.14, yields: 0.2, growth: 0.18 };
  }
  if (horizon === "sixMonth") {
    return { fedPolicy: 0.24, inflation: 0.16, growth: 0.24, yields: 0.16, liquidity: 0.2 };
  }
  return { fedPolicy: 0.18, macroCycle: 0.32, credit: 0.18, growth: 0.2, dollar: 0.12 };
}

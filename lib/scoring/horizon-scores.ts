import type { BaseScores, HorizonScores } from "@/types/intelligence";
import { clampScore } from "./scale";

export function computeHorizonScores(baseScores: BaseScores): HorizonScores {
  const swing = clampScore(
    baseScores.technical * 0.34 +
      baseScores.flow * 0.24 +
      baseScores.news * 0.16 +
      baseScores.crowd * 0.14 +
      baseScores.macro * 0.12
  );

  const threeMonth = clampScore(
    baseScores.technical * 0.24 +
      baseScores.fundamentals * 0.26 +
      baseScores.flow * 0.18 +
      baseScores.news * 0.12 +
      baseScores.macro * 0.12 +
      baseScores.crowd * 0.08
  );

  const sixMonth = clampScore(
    baseScores.fundamentals * 0.3 +
      baseScores.macro * 0.2 +
      baseScores.technical * 0.18 +
      baseScores.flow * 0.14 +
      baseScores.news * 0.1 +
      baseScores.crowd * 0.08
  );

  const oneYear = clampScore(
    baseScores.fundamentals * 0.36 +
      baseScores.macro * 0.22 +
      baseScores.technical * 0.14 +
      baseScores.flow * 0.1 +
      baseScores.news * 0.08 +
      baseScores.crowd * 0.1
  );

  return {
    swing,
    threeMonth,
    sixMonth,
    oneYear,
  };
}

import type { BaseScores, IntelligenceFactors } from "@/types/intelligence";
import { clampScore } from "./scale";

export function computeBaseScores(factors: IntelligenceFactors): BaseScores {
  return {
    technical: clampScore(factors.technical),
    fundamentals: clampScore(factors.fundamentals),
    flow: clampScore(factors.flow),
    news: clampScore(factors.news),
    macro: clampScore(factors.macro),
    crowd: clampScore(factors.crowd),
  };
}

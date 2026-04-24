import type {
  IntelligenceLabel,
  RiskLevel,
  StrategyRecommendation,
} from "@/types/intelligence";
import { clampScore } from "./scale";

export function scoreToLabel(score: number): IntelligenceLabel {
  const safe = clampScore(score);

  if (safe >= 8.7) return "Strong Buy";
  if (safe >= 7.2) return "Buy";
  if (safe >= 5.4) return "Watch";
  if (safe >= 3.5) return "Caution";
  return "Avoid";
}

export function scoreToRiskLevel(score: number): RiskLevel {
  const safe = clampScore(score);

  if (safe >= 7.2) {
    return "LOW";
  }

  if (safe >= 4.7) {
    return "MEDIUM";
  }

  return "HIGH";
}

export function scoreToConfidencePct(score: number): number {
  return Math.round((clampScore(score) / 10) * 100);
}

export function pickBestStrategy(score: number, riskLevel: RiskLevel): StrategyRecommendation {
  const safe = clampScore(score);

  if (safe >= 8.8 && riskLevel === "LOW") return "BUY_SHARES_AND_CALLS";
  if (safe >= 8.1 && riskLevel !== "HIGH") return "BUY_CALLS";
  if (safe >= 7.1) return "BUY_SHARES";
  if (safe <= 2.8) return "AVOID";
  if (safe <= 4.0 && riskLevel === "HIGH") return "BUY_PUTS";
  return "WATCH";
}

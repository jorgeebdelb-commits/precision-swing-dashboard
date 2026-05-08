import type { SwingEngineOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runSwingEngine(input: NormalizedSymbolInput): SwingEngineOutput {
  const trendUp = input.lr50 > input.lr100 && input.price >= input.vwap;
  const momentumStrong = input.rsi >= 58 && input.volumeRatio >= 1.2;
  const breakoutQuality = input.price > input.resistance && input.volumeRatio >= 1.3 ? "Clean" : input.price > input.resistance ? "Questionable" : input.price < input.support ? "Failed" : "None";
  let bias: SwingEngineOutput["bias"] = "No Trade";
  if (trendUp && momentumStrong) bias = "Swing Buy";
  else if (!trendUp && input.rsi < 42 && input.price < input.vwap) bias = "Swing Put Opportunity";
  else if (input.atrPercent > 5.5) bias = "Swing Avoid";
  else bias = "Swing Watch";
  const confidence = Math.max(30, Math.min(92, Math.round((input.technicalScore * 8 + input.volumeRatio * 12 + (trendUp ? 12 : -8)))));
  const entry = `${(input.support * 1.01).toFixed(2)} - ${(input.support * 1.03).toFixed(2)}`;
  const stop = `${(input.support * 0.97).toFixed(2)} - ${(input.support * 0.99).toFixed(2)}`;
  const t1 = (input.resistance * 1.02).toFixed(2);
  const t2 = (input.resistance * 1.06).toFixed(2);
  return { symbol: input.symbol, bias, confidence, momentumQuality: momentumStrong ? "Strong" : input.rsi >= 48 ? "Moderate" : "Weak", entryZone: entry, stopZone: stop, target1: t1, target2: t2, breakoutQuality, riskReward: "1:2", executionNotes: ["Swing lane owns short-term directional bias.", "Wait for rejection confirmation before put deployment."] };
}

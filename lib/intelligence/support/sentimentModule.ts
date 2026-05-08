import type { SentimentModuleOutput } from "@/lib/intelligence/types/battlefield";
import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";

export function runSentimentModule(input: NormalizedSymbolInput): SentimentModuleOutput {
  const state = input.sentimentScore > 7.7 ? "Hype Risk" : input.sentimentScore >= 6.4 ? "Positive" : input.sentimentScore <= 4.5 ? "Negative" : "Neutral";
  return { sentimentState: state, confirmationStrength: state === "Positive" ? "Strong" : state === "Neutral" ? "Moderate" : "Weak", crowdingRisk: state === "Hype Risk" ? "High" : "Moderate", interpretation: state === "Hype Risk" ? "Crowding risk elevated; avoid chasing options premiums." : "Sentiment used for confirmation only." };
}

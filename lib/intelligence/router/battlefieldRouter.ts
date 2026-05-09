import type { NormalizedSymbolInput } from "@/lib/intelligence/adapters/normalizeSymbolInput";
import { runLongEngine } from "@/lib/intelligence/core/longEngine";
import { runSwingEngine } from "@/lib/intelligence/core/swingEngine";
import { buildCapitalDeployment } from "@/lib/intelligence/deployment/capitalDeployment";
import { resolveBattlefieldState } from "@/lib/intelligence/resolver/battlefieldStateResolver";
import { runMacroModule } from "@/lib/intelligence/support/macroModule";
import { runPoliticsModule } from "@/lib/intelligence/support/politicsModule";
import { runSentimentModule } from "@/lib/intelligence/support/sentimentModule";
import { runWhaleModule } from "@/lib/intelligence/support/whaleModule";
import type { BattlefieldOutput } from "@/lib/intelligence/types/battlefield";

export function routeBattlefield(input: NormalizedSymbolInput): BattlefieldOutput {
  const swing = runSwingEngine(input);
  const longTerm = runLongEngine(input);
  const whale = runWhaleModule(input);
  const macro = runMacroModule(input);
  const politics = runPoliticsModule(input);
  const sentiment = runSentimentModule(input);
  const deployment = buildCapitalDeployment(swing, longTerm, whale, macro, sentiment);
  const resolved = resolveBattlefieldState({ symbol: input.symbol, swing, longTerm, whale, macro, politics, sentiment });

  return {
    symbol: input.symbol, price: input.price, priceTimestamp: input.priceTimestamp ?? null, marketDataState: input.marketDataState ?? "offline", staleData: input.staleData ?? true,
    marketDataProvider: input.quoteProvider ?? "Unknown", lastQuoteSuccessAt: input.lastQuoteSuccessAt ?? null, lastQuoteError: input.lastQuoteError ?? null, providerLatencyMs: input.providerLatencyMs ?? null,
    quoteRetryCount: input.quoteRetryCount ?? 0, staleAgeSeconds: input.staleAgeSeconds ?? null, quoteQuotaStatus: input.quoteQuotaStatus ?? null, quoteIntegrityScore: input.quoteIntegrityScore ?? 0, quoteSuspect: input.quoteSuspect ?? false,
    swing, longTerm, whale, macro, politics, sentiment, battlefieldSummary: `${input.symbol}: ${resolved.primaryOpportunity} setup in ${resolved.battlefieldState}.`, primaryOpportunity: resolved.primaryOpportunity,
    warnings: resolved.riskFlags, confidenceAdjustment: resolved.confidenceAdjusted, deployment, signalAttribution: resolved.signalAttribution, tradeOutcome: null,
  };
}

import type { HorizonKey } from "@/lib/intelligence/types";
import type { LayerScores } from "@/lib/intelligence/scoring";

function horizonLabel(horizon: HorizonKey): string {
  if (horizon === "swing") return "Swing";
  if (horizon === "threeMonth") return "3M";
  if (horizon === "sixMonth") return "6M";
  return "1Y";
}

export function buildTopReasons(params: {
  symbol: string;
  horizon: HorizonKey;
  rating: string;
  layerScores: LayerScores;
}): string[] {
  const { symbol, layerScores } = params;
  const symbolNotes: Record<string, string[]> = {
    NVDA: ["AI leadership keeps demand and revisions elevated."],
    AMD: ["Semiconductor strength and roadmap execution keep upside credible despite fierce competition."],
    AMZN: ["Cloud + consumer mix adds resilience and cash-flow durability."],
    MARA: ["BTC beta can accelerate upside but keeps this setup speculative."],
    NEM: ["Gold-miner defensiveness helps in risk-off regimes, but momentum remains softer."],
    TSLA: ["EV narrative and policy sensitivity amplify both upside bursts and drawdown risk."],
    PLTR: ["Government + enterprise AI contract pipeline supports multi-quarter visibility."],
  };

  const ranked = [
    { key: "technical", score: layerScores.technicalScore },
    { key: "flow", score: layerScores.flowScore },
    { key: "sentiment", score: layerScores.sentimentScore },
    { key: "macro", score: layerScores.macroScore },
    { key: "fundamental", score: layerScores.fundamentalScore },
  ].sort((a, b) => b.score - a.score);

  const dynamicReasons = ranked.slice(0, 2).map((item) => {
    if (item.key === "technical") return "Price structure and trend quality are supporting upside.";
    if (item.key === "flow") return "Flow and participation show institutional support.";
    if (item.key === "sentiment") return "News and sentiment backdrop remains constructive.";
    if (item.key === "macro") return "Macro and policy conditions are supportive for this setup.";
    return "Fundamental quality and earnings durability support the thesis.";
  });

  const weakest = ranked[ranked.length - 1];
  const caution =
    weakest.key === "sentiment"
      ? "Headline clarity is still mixed, so conviction should be sized appropriately."
      : weakest.key === "macro"
        ? "Macro crosswinds still require tighter risk controls."
        : weakest.key === "flow"
          ? "Participation is improving but not yet broad enough for full conviction."
          : weakest.key === "technical"
            ? "Trend has improved, but the chart still needs cleaner confirmation."
            : "Fundamental support is improving but still trails leaders.";

  return [...(symbolNotes[symbol] ?? []), ...dynamicReasons, caution].slice(0, 3);
}

export function buildReasonText(params: {
  symbol: string;
  horizon: HorizonKey;
  rating: string;
  reasons: string[];
}): string {
  const intro = `${params.symbol} ${horizonLabel(params.horizon)} ${params.rating} because:`;
  return `${intro} ${params.reasons.map((reason) => `- ${reason}`).join(" ")}`;
}

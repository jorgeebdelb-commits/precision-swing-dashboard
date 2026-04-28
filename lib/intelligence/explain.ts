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
  const { layerScores } = params;
  const ranked = [
    { key: "technical", score: layerScores.technicalScore },
    { key: "flow", score: layerScores.flowScore },
    { key: "sentiment", score: layerScores.sentimentScore },
    { key: "macro", score: layerScores.macroScore },
    { key: "fundamental", score: layerScores.fundamentalScore },
  ].sort((a, b) => b.score - a.score);

  return ranked.slice(0, 3).map((item) => {
    if (item.key === "technical") return "Price structure and trend quality are supporting upside.";
    if (item.key === "flow") return "Flow and participation show institutional support.";
    if (item.key === "sentiment") return "News and sentiment backdrop remains constructive.";
    if (item.key === "macro") return "Macro and policy conditions are supportive for this setup.";
    return "Fundamental quality and earnings durability support the thesis.";
  });
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

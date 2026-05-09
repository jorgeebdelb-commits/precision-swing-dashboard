import type { Item } from "@/types/dashboard";
import type { RowMetrics } from "@/engines/strategy";

export type RiskStyle = "Conservative" | "Balanced" | "Aggressive";
export type StrategyType = "Auto" | "Shares" | "Calls" | "Puts" | "Hybrid";
export type DeploymentHorizon = "Swing" | "3 Month" | "6 Month" | "1 Year";

type TradeBias = "Bullish" | "Bearish" | "Neutral";

export type TradeDeployment = {
  symbol: string;
  horizon: DeploymentHorizon;
  bias: TradeBias;
  recommendation: string;
  strategy: StrategyType | "No Trade";
  conviction: string;
  currentPrice: number;
  capitalToDeploy: number;
  capitalUsed: number;
  sharesPlan: {
    action: string;
    quantity: number;
    entryPrice: number;
    capitalUsed: number;
  };
  optionsPlan: {
    action: string;
    contractType: "Call" | "Put" | "None";
    strike: number | null;
    expiration: string | null;
    contracts: number;
    estimatedPremium: number;
    capitalUsed: number;
    rationale: string;
  };
  entryPlan: {
    starterEntry: number | null;
    addZone: string;
    breakoutAdd: string;
  };
  profitTargets: {
    target1Price: number | null;
    target1Action: string;
    target2Price: number | null;
    target2Action: string;
    runnerPlan: string;
  };
  riskManagement: {
    stopLossPrice: number | null;
    invalidationLevel: string;
    maxDollarRisk: number;
    maxPercentRisk: number;
    optionStopPercent: number;
  };
  expectedReturn: {
    minimumTargetPercent: number;
    realisticTargetPercent: number;
    optimizedUpsidePercent: number;
  };
  tradeQuality: {
    technicals: number;
    momentum: number;
    sentiment: number;
    macro: number;
    options: number;
    overall: number;
  };
  warnings: string[];
};

const unavailableBattlefieldPricing: TradeDeployment = {
  symbol: "N/A",
  horizon: "Swing",
  bias: "Neutral",
  recommendation: "Unavailable",
  strategy: "No Trade",
  conviction: "Low",
  currentPrice: 0,
  capitalToDeploy: 0,
  capitalUsed: 0,
  sharesPlan: {
    action: "Unavailable",
    quantity: 0,
    entryPrice: 0,
    capitalUsed: 0,
  },
  optionsPlan: {
    action: "Unavailable",
    contractType: "None",
    strike: null,
    expiration: null,
    contracts: 0,
    estimatedPremium: 0,
    capitalUsed: 0,
    rationale: "Awaiting live market data",
  },
  entryPlan: {
    starterEntry: null,
    addZone: "Unavailable",
    breakoutAdd: "Awaiting live market data",
  },
  profitTargets: {
    target1Price: null,
    target1Action: "Unavailable",
    target2Price: null,
    target2Action: "Unavailable",
    runnerPlan: "Market pricing offline",
  },
  riskManagement: {
    stopLossPrice: null,
    invalidationLevel: "Unavailable",
    maxDollarRisk: 0,
    maxPercentRisk: 0,
    optionStopPercent: 0,
  },
  expectedReturn: {
    minimumTargetPercent: 0,
    realisticTargetPercent: 0,
    optimizedUpsidePercent: 0,
  },
  tradeQuality: {
    technicals: 0,
    momentum: 0,
    sentiment: 0,
    macro: 0,
    options: 0,
    overall: 0,
  },
  warnings: ["Market pricing offline", "Awaiting live market data"],
};

const toBias = (analysis: RowMetrics): TradeBias => {
  const rec = analysis.recommendation.toLowerCase();
  if (rec.includes("sell") || rec.includes("bear") || analysis.swingSignal === "Sell") return "Bearish";
  if (rec.includes("buy") || analysis.swingSignal === "Buy" || analysis.swingSignal === "Strong Buy") return "Bullish";
  return "Neutral";
};

const dteByHorizon = (horizon: DeploymentHorizon): string => {
  if (horizon === "Swing") return "30-45 DTE";
  if (horizon === "3 Month") return "60-120 DTE";
  if (horizon === "6 Month") return "120-210 DTE";
  return "300+ DTE";
};

export function generateTradeDeployment({
  selectedTicker,
  selectedAnalysis,
  capitalToDeploy,
  horizon,
  riskStyle,
  strategyType,
}: {
  selectedTicker: Item | null;
  selectedAnalysis: RowMetrics | null;
  capitalToDeploy: number;
  horizon: DeploymentHorizon;
  riskStyle: RiskStyle;
  strategyType: StrategyType;
}): TradeDeployment | null {
  if (!selectedTicker || !selectedAnalysis || capitalToDeploy <= 0) return null;
  const livePrice = Number(selectedTicker.price);
  if (!livePrice || livePrice <= 0) {
    return {
      ...unavailableBattlefieldPricing,
      symbol: selectedTicker.symbol,
      horizon,
      capitalToDeploy,
      warnings: [...unavailableBattlefieldPricing.warnings],
    };
  }

  const warnings: string[] = [];
  const currentPrice = livePrice;
  const support = Number(selectedTicker.support) || currentPrice * 0.96;
  const resistance = Number(selectedTicker.resistance) || currentPrice * 1.08;
  const atrPct = Number((selectedTicker as unknown as { atrPct?: number }).atrPct) || 2.8;
  const atr = Math.max(0, currentPrice * (atrPct / 100));
  const bias = toBias(selectedAnalysis);

  const conviction = selectedAnalysis.confidenceLabel;
  const highConfidence = conviction === "High";
  const mediumConfidence = conviction === "Medium";

  const optionStopPercent = riskStyle === "Conservative" ? 12 : riskStyle === "Aggressive" ? 25 : 18;

  let strategy: TradeDeployment["strategy"] = strategyType;
  if (strategyType === "Auto") {
    if (bias === "Bullish" && highConfidence && riskStyle !== "Conservative") strategy = "Hybrid";
    else if (bias === "Bearish") strategy = mediumConfidence || highConfidence ? "Puts" : "No Trade";
    else if (bias === "Neutral") strategy = mediumConfidence ? "Shares" : "No Trade";
    else strategy = "Shares";
  }

  if (bias === "Bullish" && strategy === "Puts") warnings.push("This conflicts with bullish analysis.");
  if (bias === "Bearish" && strategy === "Calls") {
    warnings.push("Calls are blocked on bearish setups; downgraded to puts.");
    strategy = "Puts";
  }
  if (bias === "Neutral" && (strategy === "Calls" || strategy === "Puts" || strategy === "Hybrid")) {
    warnings.push("Neutral/choppy setup: aggressive options need breakout confirmation.");
    strategy = "Shares";
  }
  if (conviction === "Low" && ["Calls", "Puts", "Hybrid"].includes(strategy)) {
    warnings.push("Low confidence setup: options disabled.");
    strategy = "Shares";
  }

  const baseCapitalPct = riskStyle === "Conservative" ? 0.55 : riskStyle === "Aggressive" ? 0.95 : 0.78;
  const confidencePct = conviction === "High" ? 1 : conviction === "Medium" ? 0.8 : 0.45;
  const usableCapital = capitalToDeploy * baseCapitalPct * confidencePct;

  let shareCapital = 0;
  let optionCapital = 0;
  if (strategy === "Shares") shareCapital = usableCapital;
  if (strategy === "Calls" || strategy === "Puts") optionCapital = usableCapital;
  if (strategy === "Hybrid") {
    shareCapital = usableCapital * (riskStyle === "Aggressive" ? 0.55 : 0.75);
    optionCapital = usableCapital - shareCapital;
  }

  const quantity = Math.floor(shareCapital / currentPrice);
  const shareUsed = quantity * currentPrice;

  const target1Floor = currentPrice * 1.05;
  const target1Price = resistance > currentPrice ? Math.min(resistance, target1Floor) : target1Floor;
  const target2Price = Math.max(resistance, currentPrice + Math.max(atr * 2.2, currentPrice * 0.09));
  const stopLoss = support > 0 ? support : atr > 0 ? currentPrice - atr * 1.5 : currentPrice * 0.96;

  const contractType = strategy === "Puts" ? "Put" : strategy === "Calls" || strategy === "Hybrid" ? "Call" : "None";
  const strike =
    contractType === "Call"
      ? Math.round(currentPrice * (highConfidence ? 1.05 : 1.03))
      : contractType === "Put"
      ? Math.round(currentPrice * 0.95)
      : null;
  const estimatedPremium = strike ? Number((Math.max(1.2, currentPrice * 0.024)).toFixed(2)) : 0;
  const contracts = estimatedPremium > 0 ? Math.floor(optionCapital / (estimatedPremium * 100)) : 0;
  const optionUsed = contracts * estimatedPremium * 100;
  if (contractType !== "None") warnings.push("Options premium is estimated; live chain unavailable.");

  const capitalUsed = shareUsed + optionUsed;
  const maxDollarRisk = Math.max(0, (currentPrice - stopLoss) * quantity + optionUsed * (optionStopPercent / 100));
  const maxPercentRisk = capitalUsed > 0 ? (maxDollarRisk / capitalUsed) * 100 : 0;

  return {
    symbol: selectedTicker.symbol,
    horizon,
    bias,
    recommendation: selectedAnalysis.recommendation,
    strategy,
    conviction,
    currentPrice,
    capitalToDeploy,
    capitalUsed,
    sharesPlan: {
      action: quantity > 0 ? `Buy ${quantity} shares` : "No shares",
      quantity,
      entryPrice: currentPrice,
      capitalUsed: shareUsed,
    },
    optionsPlan: {
      action: contracts > 0 ? `Buy ${contracts} ${contractType.toLowerCase()} contract(s)` : "No options",
      contractType,
      strike,
      expiration: contractType === "None" ? null : dteByHorizon(horizon),
      contracts,
      estimatedPremium,
      capitalUsed: optionUsed,
      rationale: contractType === "None" ? "Not required for this setup." : `${contractType}s align with ${bias.toLowerCase()} bias.`,
    },
    entryPlan: {
      starterEntry: currentPrice,
      addZone: `$${support.toFixed(2)} support bounce`,
      breakoutAdd: `Above $${(currentPrice * 1.015).toFixed(2)} with volume`,
    },
    profitTargets: {
      target1Price,
      target1Action: "Take partial profits (50%)",
      target2Price,
      target2Action: "Trim remaining and trail runner",
      runnerPlan: "Trail using ATR-based stop.",
    },
    riskManagement: {
      stopLossPrice: stopLoss,
      invalidationLevel: `Lose $${support.toFixed(2)} support`,
      maxDollarRisk,
      maxPercentRisk,
      optionStopPercent,
    },
    expectedReturn: {
      minimumTargetPercent: 5,
      realisticTargetPercent: Number((((target1Price - currentPrice) / currentPrice) * 100).toFixed(1)),
      optimizedUpsidePercent: Number((((target2Price - currentPrice) / currentPrice) * 100).toFixed(1)),
    },
    tradeQuality: {
      technicals: Math.round(selectedAnalysis.technical),
      momentum: Math.round(selectedAnalysis.momentumToday / 10),
      sentiment: Math.round(selectedAnalysis.intelligence),
      macro: Math.round(selectedAnalysis.environment),
      options: highConfidence ? 8 : mediumConfidence ? 6 : 3,
      overall: Math.round((selectedAnalysis.finalScore || 0) / 10),
    },
    warnings,
  };
}

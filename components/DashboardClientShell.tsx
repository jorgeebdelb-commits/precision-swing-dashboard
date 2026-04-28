"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Item,
  RiskLabel,
  Strategy,
  QuoteResponse,
  SentimentResponse,
} from "@/types/dashboard";
import { computeMetrics, type RowMetrics } from "@/engines/strategy";
import { supabase } from "@/app/lib/supabase";
import { num, upper } from "@/app/lib/helpers";
import type { IntelligenceApiResponse } from "@/lib/intelligence/types";
import {
  mapIntelligenceSummaryToRuntime,
  mapItemToWatchlistPersistedRow,
  mapWatchlistRowToItem,
} from "@/lib/watchlist/dbMapper";
import { WATCHLIST_SELECT, WATCHLIST_TABLE, type WatchlistRow } from "@/lib/watchlist/schema";
import InfoHelp from "@/components/ui/InfoHelp";

type ChartRange = "1D" | "5D" | "1M";

type ChartPoint = {
  label: string;
  price: number;
  source: "live" | "generated";
};

type RowData = {
  item: Item;
  metrics: RowMetrics;
};

type EngineKey = "swing" | "threeMonth" | "sixMonth" | "oneYear";
type DecisionSignal = "Bullish" | "Bearish" | "Neutral";
type Tradeability = "Full Size" | "Starter Size" | "Speculative" | "Avoid";

type RiskStyle = "Conservative" | "Balanced" | "Aggressive";
type HorizonFocus = "Swing" | "3 Month" | "6 Month" | "1 Year";

const HORIZON_OPTIONS: Array<{ key: EngineKey; label: string }> = [
  { key: "swing", label: "Swing (<3M)" },
  { key: "threeMonth", label: "3 Month" },
  { key: "sixMonth", label: "6 Month" },
  { key: "oneYear", label: "1 Year+ / LEAPS" },
];

function scoreColor(score: number) {

  if (score >= 90) return "#22c55e";
  if (score >= 80) return "#4ade80";
  if (score >= 70) return "#facc15";
  if (score >= 60) return "#fb923c";
  return "#ef4444";
}

function signalColor(signal: string) {
  if (signal === "Strong Buy") return "#22c55e";
  if (signal === "Buy") return "#4ade80";
  if (signal === "Watch") return "#f59e0b";
  if (signal === "Caution") return "#fb923c";
  return "#ef4444";
}

function riskColor(risk: "Unknown" | RiskLabel) {
  if (risk === "Unknown") return "#94a3b8";
  if (risk === "Low") return "#22c55e";
  if (risk === "Medium") return "#f59e0b";
  if (risk === "High") return "#ef4444";
  return "#b91c1c";
}

function softCard(signal?: string) {
  const bg =
    signal === "Strong Buy"
      ? "linear-gradient(180deg, rgba(34,197,94,0.18), rgba(15,23,42,0.92))"
      : signal === "Buy"
      ? "linear-gradient(180deg, rgba(74,222,128,0.14), rgba(15,23,42,0.92))"
      : signal === "Watch"
      ? "linear-gradient(180deg, rgba(245,158,11,0.14), rgba(15,23,42,0.92))"
      : signal === "Caution"
      ? "linear-gradient(180deg, rgba(251,146,60,0.14), rgba(15,23,42,0.92))"
      : "linear-gradient(180deg, rgba(239,68,68,0.14), rgba(15,23,42,0.92))";

  return {
    background: bg,
    border: "1px solid rgba(148,163,184,0.18)",
    borderRadius: 18,
    boxShadow: "0 16px 48px rgba(2,6,23,0.34)",
    backdropFilter: "blur(10px)",
  } as const;
}

function panelStyle() {
  return {
    background: "rgba(15,23,42,0.78)",
    border: "1px solid rgba(148,163,184,0.14)",
    borderRadius: 18,
    boxShadow: "0 16px 48px rgba(2,6,23,0.34)",
    backdropFilter: "blur(12px)",
  } as const;
}

function statCardStyle() {
  return {
    background: "rgba(30,41,59,0.72)",
    border: "1px solid rgba(148,163,184,0.14)",
    borderRadius: 14,
    padding: 14,
  } as const;
}

function SectionHelp({
  title,
  content,
  heading = "h3",
  marginTop = 0,
}: {
  title: string;
  content: ReactNode;
  heading?: "h2" | "h3" | "h4";
  marginTop?: number;
}) {
  const Tag = heading;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <Tag style={{ margin: `${marginTop}px 0 0 0`, color: "#f8fafc" }}>{title}</Tag>
      <InfoHelp title={title} content={content} placement="left" />
    </div>
  );
}

function parsePriceValue(value: string): number | null {
  const clean = value.replace(/[^\d.-]/g, "");
  const parsed = Number.parseFloat(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function parsePriceRange(value: string): [number, number] | null {
  const matches = value.match(/-?\d+(\.\d+)?/g);
  if (!matches || matches.length < 2) return null;
  const low = Number.parseFloat(matches[0]);
  const high = Number.parseFloat(matches[1]);
  if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
  return low <= high ? [low, high] : [high, low];
}

function toMomentumLabel(score: number): "Bullish" | "Neutral" | "Bearish" {
  if (score >= 65) return "Bullish";
  if (score <= 45) return "Bearish";
  return "Neutral";
}

function toDisplayScore(score: number): number {
  return Math.round(num(score) * 10);
}



function engineScore(metrics: RowMetrics, engine: EngineKey): number {
  if (engine === "swing") return metrics.swing;
  if (engine === "threeMonth") return metrics.threeMonth;
  if (engine === "sixMonth") return metrics.sixMonth;
  return metrics.oneYear;
}

function engineVerdict(metrics: RowMetrics, engine: EngineKey): string {
  if (engine === "swing") return metrics.swingSignal;
  if (engine === "threeMonth") return metrics.threeMonthSignal;
  if (engine === "sixMonth") return metrics.sixMonthSignal;
  return metrics.oneYearSignal;
}

function engineRisk(metrics: RowMetrics, engine: EngineKey): RiskLabel {
  const base = metrics.riskLabel === "Extreme" ? 4 : metrics.riskLabel === "High" ? 3 : metrics.riskLabel === "Medium" ? 2 : 1;
  const horizonAdjust = engine === "swing" ? 1 : engine === "threeMonth" ? 0 : engine === "sixMonth" ? -0.2 : -0.35;
  const scoreAdjust = (7 - engineScore(metrics, engine)) * 0.35;
  const riskNumber = Math.max(1, Math.min(4, base + horizonAdjust + scoreAdjust));
  if (riskNumber >= 3.6) return "Extreme";
  if (riskNumber >= 2.8) return "High";
  if (riskNumber >= 1.9) return "Medium";
  return "Low";
}

function strategyForEngine(metrics: RowMetrics, engine: EngineKey): Strategy {
  if (engine === "swing") return metrics.swingStrategy;
  if (engine === "threeMonth") return metrics.threeMonthStrategy;
  if (engine === "sixMonth") return metrics.sixMonthStrategy;
  return metrics.oneYearStrategy;
}

function decisionSignal(metrics: RowMetrics, engine: EngineKey): DecisionSignal {
  const strategy = strategyForEngine(metrics, engine);
  if (strategy === "Avoid" || strategy === "Buy Puts") return "Bearish";
  if (
    strategy === "Buy Shares" ||
    strategy === "Spec Buy" ||
    strategy === "Buy Shares + Calls" ||
    strategy === "Buy Calls" ||
    strategy === "Starter Shares" ||
    strategy === "Starter Shares + Calls on Breakout"
  ) {
    return "Bullish";
  }
  const verdict = engineVerdict(metrics, engine);
  if (verdict === "Strong Buy" || verdict === "Buy") return "Bullish";
  if (verdict === "Caution" || verdict === "Avoid" || verdict === "Strong Avoid") return "Bearish";
  return "Neutral";
}

function tradeabilityFromDecision(signal: DecisionSignal, risk: RiskLabel): Tradeability {
  if (risk === "Extreme") return "Speculative";
  if (signal === "Bearish") return "Avoid";
  if (signal === "Bullish") {
    if (risk === "Low") return "Full Size";
    if (risk === "Medium") return "Starter Size";
    return "Speculative";
  }
  if (risk === "Low" || risk === "Medium") return "Starter Size";
  return "Speculative";
}

function buildDecision(metrics: RowMetrics, engine: EngineKey): { signal: DecisionSignal; risk: RiskLabel; tradeability: Tradeability } {
  const signal = decisionSignal(metrics, engine);
  const risk = engineRisk(metrics, engine);
  const tradeability = tradeabilityFromDecision(signal, risk);
  return { signal, risk, tradeability };
}

function bestStrategy(metrics: RowMetrics): Strategy {
  const ranked: Array<{ engine: EngineKey; score: number; strategy: Strategy }> = [
    { engine: "swing", score: metrics.swing, strategy: metrics.swingStrategy },
    { engine: "threeMonth", score: metrics.threeMonth, strategy: metrics.threeMonthStrategy },
    { engine: "sixMonth", score: metrics.sixMonth, strategy: metrics.sixMonthStrategy },
    { engine: "oneYear", score: metrics.oneYear, strategy: metrics.oneYearStrategy },
  ];
  ranked.sort((a, b) => b.score - a.score);
  return ranked[0]?.strategy ?? metrics.strategy;
}

function inferSectorForSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  if (["NVDA", "AMD", "MRVL", "AVGO", "TSM"].includes(upperSymbol)) return "Semiconductors";
  if (["AMZN", "MSFT", "META", "GOOGL", "AAPL"].includes(upperSymbol)) return "Megacap Tech";
  if (["TSLA", "RIVN", "LCID"].includes(upperSymbol)) return "EV";
  if (["MARA", "WULF", "RIOT", "CLSK", "IREN"].includes(upperSymbol)) return "Crypto Mining";
  if (["JOBY", "ACHR"].includes(upperSymbol)) return "Industrials";
  if (["IBRX", "LLY", "PFE", "JNJ"].includes(upperSymbol)) return "Healthcare";
  if (["QUBT", "QBTS", "RGTI", "IONQ"].includes(upperSymbol)) return "Quantum / Frontier Tech";
  if (["XOM", "CVX", "SLB"].includes(upperSymbol)) return "Energy";
  if (["JPM", "MS", "GS"].includes(upperSymbol)) return "Financials";
  if (["CAT", "GE", "DE"].includes(upperSymbol)) return "Industrials";
  return "Other";
}

const WATCHLIST_CACHE_KEY = "precision-dashboard-watchlist-cache";
const SELECTED_SYMBOL_KEY = "precision-dashboard-selected-symbol";

const pickDefaultSymbol = (entries: Item[], persistedSymbol?: string | null): string => {
  const normalizedPersisted = upper(persistedSymbol ?? "");
  if (normalizedPersisted && entries.some((item) => item.symbol === normalizedPersisted)) {
    return normalizedPersisted;
  }

  const ranked = entries
    .map((item) => ({
      item,
      metrics: computeMetrics(item),
    }))
    .sort((a, b) => b.metrics.swing - a.metrics.swing);

  return (
    ranked.find((row) => row.metrics.confidenceLabel === "High")?.item.symbol ??
    ranked[0]?.item.symbol ??
    ""
  );
};

function strategyToBias(strategy: Strategy): Item["bias"] {
  if (strategy === "Avoid" || strategy === "Buy Puts") return "Bearish";
  if (
    strategy === "Buy Shares" ||
    strategy === "Spec Buy" ||
    strategy === "Buy Shares + Calls" ||
    strategy === "Buy Calls" ||
    strategy === "Starter Shares" ||
    strategy === "Starter Shares + Calls on Breakout"
  ) {
    return "Bullish";
  }
  return "Watch";
}

function mergeWatchlistWithIntelligence(baseRows: Record<string, unknown>[], intelligence: IntelligenceApiResponse): Item[] {
  const runtimeBySymbol = new Map(
    intelligence.items.map((summary) => {
      const runtime = mapIntelligenceSummaryToRuntime(summary);
      return [
        summary.symbol,
        {
          ...runtime,
          bias: strategyToBias((summary.executionStrategy as Strategy) ?? summary.analyses[0]?.strategy ?? "Watch"),
        },
      ];
    })
  );

  return baseRows
    .map((row) => {
      const symbol = typeof row.symbol === "string" ? row.symbol : "";
      const runtime = symbol ? runtimeBySymbol.get(symbol) : undefined;
      const mapped = mapWatchlistRowToItem(row, runtime);
      return runtime?.bias ? { ...mapped, bias: runtime.bias } : mapped;
    })
    .filter((item) => item.symbol);
}

export default function DashboardClientShell() {
  const sitePassword = process.env.NEXT_PUBLIC_SITE_PASSWORD ?? "";

  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [newSymbol, setNewSymbol] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshingIntelligence, setRefreshingIntelligence] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState("");

  const [intelligenceMessage, setIntelligenceMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("-");

  const [quoteMeta, setQuoteMeta] = useState<QuoteResponse | null>(null);
  const [sentimentMeta, setSentimentMeta] =
    useState<SentimentResponse | null>(null);

  const [history, setHistory] = useState<{ time: string; price: number }[]>([]);
  const [chartRange, setChartRange] = useState<ChartRange>("1D");
  const [portfolioCapitalInput, setPortfolioCapitalInput] = useState("0");
  const [portfolioRiskStyle, setPortfolioRiskStyle] = useState<RiskStyle>("Balanced");
  const [portfolioHorizonFocus, setPortfolioHorizonFocus] = useState<HorizonFocus>("Swing");
  const [watchlistHorizon, setWatchlistHorizon] = useState<EngineKey>("swing");
  const latestItemsRef = useRef<Item[]>([]);

  useEffect(() => {
    latestItemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const unlocked = localStorage.getItem("precision-dashboard-auth");
    if (unlocked === "true") setAuthenticated(true);
  }, []);

  useEffect(() => {
    const loadWatchlist = async () => {
      setLoading(true);
      const persistedSymbol = localStorage.getItem(SELECTED_SYMBOL_KEY);

      try {
        if (!supabase) {
          const cached = localStorage.getItem(WATCHLIST_CACHE_KEY);
          if (!cached) {
            setItems([]);
            setSelectedSymbol("");
            return;
          }

          const parsed: unknown = JSON.parse(cached);
          const cachedItems = Array.isArray(parsed)
            ? parsed.filter(
                (entry): entry is Item =>
                  typeof entry === "object" &&
                  entry !== null &&
                  typeof (entry as Item).symbol === "string"
              )
            : [];

          setItems(cachedItems);
          setSelectedSymbol(pickDefaultSymbol(cachedItems, persistedSymbol));
          return;
        }

        const { data, error } = await supabase
          .from(WATCHLIST_TABLE)
          .select(WATCHLIST_SELECT)
          .order("created_at", { ascending: true });

        if (error) {
          setIntelligenceMessage(`Failed to load watchlist: ${error.message}`);
          return;
        }

        const dbRows = ((data ?? []) as unknown[]) as Partial<WatchlistRow>[];
        const symbols = dbRows
          .map((row) => (typeof row.symbol === "string" ? row.symbol : ""))
          .filter(Boolean);
        let mapped: Item[] = dbRows.map((row) => mapWatchlistRowToItem(row as Record<string, unknown>)).filter((item) => item.symbol);

        if (symbols.length) {
          const intelligenceRes = await fetch(`/api/intelligence?symbols=${encodeURIComponent(symbols.join(","))}`);
          if (intelligenceRes.ok) {
            const intelligence = (await intelligenceRes.json()) as IntelligenceApiResponse;
            mapped = mergeWatchlistWithIntelligence(dbRows as Record<string, unknown>[], intelligence);
          }
        }

        setItems(mapped);
        setSelectedSymbol(pickDefaultSymbol(mapped, persistedSymbol));
        localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(mapped));
      } catch {
        setIntelligenceMessage("Failed to load watchlist.");
      } finally {
        setLoading(false);
      }
    };

    void loadWatchlist();
  }, []);

  useEffect(() => {
    if (!items.length) {
      setSelectedSymbol("");
      localStorage.removeItem(SELECTED_SYMBOL_KEY);
      return;
    }

    const symbolExists = selectedSymbol && items.some((item) => item.symbol === selectedSymbol);
    if (!symbolExists) {
      setSelectedSymbol(pickDefaultSymbol(items, localStorage.getItem(SELECTED_SYMBOL_KEY)));
      return;
    }

    localStorage.setItem(SELECTED_SYMBOL_KEY, selectedSymbol);
  }, [items, selectedSymbol]);

  const rows = useMemo<RowData[]>(
    () =>
      items.map((item) => ({
        item,
        metrics: computeMetrics(item),
      })),
    [items]
  );

  const selectedRow = useMemo(
    () => rows.find((x) => x.item.symbol === selectedSymbol) ?? rows[0] ?? null,
    [rows, selectedSymbol]
  );

  const selectedItem = selectedRow?.item ?? null;
  const selectedMetrics = selectedRow?.metrics ?? null;
  const selectedDecision = selectedMetrics ? buildDecision(selectedMetrics, watchlistHorizon) : null;
  const momentumLabel = selectedMetrics ? toMomentumLabel(selectedMetrics.momentumToday) : "Neutral";
  const momentumColor =
    momentumLabel === "Bullish" ? "#22c55e" : momentumLabel === "Bearish" ? "#ef4444" : "#f59e0b";

  const chartSeries = useMemo<ChartPoint[]>(() => {
    if (!selectedItem) return [];

    const currentPrice = Math.max(0.01, num(selectedItem.price, 0));
    const support = Math.max(0.01, num(selectedItem.support, currentPrice * 0.97));
    const resistance = Math.max(support + 0.01, num(selectedItem.resistance, currentPrice * 1.03));

    const makeGeneratedSeries = (count: number, scale: number) => {
      const center = currentPrice > 0 ? currentPrice : (support + resistance) / 2;
      const slope = num(selectedItem.lr50Slope, 0) * 0.0009;
      const amplitude = Math.max((resistance - support) * 0.18, center * 0.0035) * scale;
      return Array.from({ length: count }, (_, index) => {
        const wave = Math.sin((index / Math.max(1, count - 1)) * Math.PI * 2.2);
        const drift = (index - count / 2) * slope * center;
        const baseline = center + drift + wave * amplitude;
        const clamped = Math.max(support * 0.9, Math.min(resistance * 1.1, baseline));
        return {
          label: `${index + 1}`,
          price: clamped,
          source: "generated" as const,
        };
      });
    };

    if (chartRange === "1D") {
      if (history.length >= 2) {
        return history.map((point, index) => ({
          label: point.time || `${index + 1}`,
          price: point.price,
          source: "live",
        }));
      }
      return [];
    }

    if (chartRange === "5D") return makeGeneratedSeries(40, 1);
    return makeGeneratedSeries(48, 1.25);
  }, [chartRange, history, selectedItem]);

  const chartStats = useMemo(() => {
    if (!selectedItem || !selectedMetrics) return null;

    const prices = chartSeries.map((point) => point.price);
    const chartLow = prices.length ? Math.min(...prices) : num(selectedItem.support, selectedItem.price * 0.97);
    const chartHigh = prices.length ? Math.max(...prices) : num(selectedItem.resistance, selectedItem.price * 1.03);
    const current = num(selectedItem.price);
    const entryRange = parsePriceRange(selectedMetrics.entryZone);
    const stopValue = parsePriceValue(selectedMetrics.stopLoss);
    const targetOne = parsePriceValue(selectedMetrics.target1);
    const targetTwo = parsePriceValue(selectedMetrics.target2);

    return {
      chartLow,
      chartHigh,
      current,
      support: num(selectedItem.support, chartLow),
      resistance: num(selectedItem.resistance, chartHigh),
      vwap: chartRange === "1D" ? prices.reduce((sum, price) => sum + price, 0) / Math.max(1, prices.length) : null,
      lr50: num(selectedItem.lr50, current * 0.995),
      lr100: num(selectedItem.lr100, current * 0.985),
      entryRange,
      stopValue,
      targetOne,
      targetTwo,
    };
  }, [chartRange, chartSeries, selectedItem, selectedMetrics]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const scoreDiff = engineScore(b.metrics, watchlistHorizon) - engineScore(a.metrics, watchlistHorizon);
      if (scoreDiff !== 0) return scoreDiff;
      return b.metrics.confidencePercent - a.metrics.confidencePercent;
    });
  }, [rows, watchlistHorizon]);

  const spotlightRows = useMemo(
    () =>
      sortedRows
        .filter((row) => num(row.item.price) > 0)
        .slice(0, 3),
    [sortedRows]
  );

  const portfolioPlan = useMemo(() => {
    const totalCapital = Math.max(0, Number.parseFloat(portfolioCapitalInput.replace(/[^\d.]/g, "")) || 0);
    if (totalCapital <= 0) {
      return {
        totalCapital: 0,
        deployableCapital: 0,
        cashReserve: 0,
        topAllocations: [],
        weightedRisk: 0,
        sectorConcentration: [],
      };
    }
    const deployBase =
      portfolioRiskStyle === "Conservative" ? 0.58 : portfolioRiskStyle === "Aggressive" ? 0.9 : 0.75;
    const focusKey =
      portfolioHorizonFocus === "Swing"
        ? "swing"
        : portfolioHorizonFocus === "3 Month"
        ? "threeMonth"
        : portfolioHorizonFocus === "6 Month"
        ? "sixMonth"
        : "oneYear";

    const confidenceByLabel: Record<RowMetrics["confidenceLabel"], number> = {
      High: 1,
      Medium: 0.78,
      Low: 0.56,
    };

    const strategyWeight = (strategy: string) => {
      if (strategy.includes("Avoid")) return 0;
      if (strategy.includes("Puts")) return 0.6;
      if (strategy.includes("Calls")) return 1.15;
      if (strategy.includes("Shares")) return 1;
      return 0.82;
    };

    const vehicleFromStrategy = (strategy: string) => {
      if (strategy.includes("Puts")) return "Puts";
      if (strategy.includes("Calls")) return "Calls";
      if (strategy.includes("Avoid")) return "Cash";
      return "Shares";
    };

    const ranked = sortedRows
      .map(({ item, metrics }, rankIndex) => {
        const resolvedStrategy = bestStrategy(metrics);
        const horizonScore =
          focusKey === "swing"
            ? metrics.swing
            : focusKey === "threeMonth"
            ? metrics.threeMonth
            : focusKey === "sixMonth"
            ? metrics.sixMonth
            : metrics.oneYear;
        const confidenceFactor = confidenceByLabel[metrics.confidenceLabel] ?? 0.6;
        const rankFactor = Math.max(0.3, 1 - rankIndex * 0.06);
        const executionFactor = strategyWeight(resolvedStrategy);
        const rawWeight = Math.max(0, horizonScore / 10) * confidenceFactor * rankFactor * executionFactor;
        return {
          symbol: item.symbol,
          strategy: resolvedStrategy,
          riskLabel: engineRisk(metrics, focusKey),
          riskScore: metrics.riskScore,
          sector: inferSectorForSymbol(item.symbol),
          vehicle: vehicleFromStrategy(resolvedStrategy),
          rawWeight,
        };
      })
      .filter((x) => x.rawWeight > 0);

    const totalWeight = ranked.reduce((sum, row) => sum + row.rawWeight, 0);
    const confidenceDrag = ranked.length
      ? ranked.reduce((sum, row) => {
          const confidence = sortedRows.find((x) => x.item.symbol === row.symbol)?.metrics.confidenceLabel ?? "Low";
          return sum + confidenceByLabel[confidence];
        }, 0) / ranked.length
      : 0.6;

    const deployableCapital = totalCapital * deployBase * (0.85 + confidenceDrag * 0.2);
    const cashReserve = Math.max(0, totalCapital - deployableCapital);

    const allocations = ranked
      .map((row) => ({
        ...row,
        dollars: totalWeight > 0 ? (row.rawWeight / totalWeight) * deployableCapital : 0,
      }))
      .sort((a, b) => b.dollars - a.dollars);

    const topAllocations = allocations.slice(0, 5);

    const weightedRisk = deployableCapital
      ? allocations.reduce((sum, row) => sum + row.riskScore * row.dollars, 0) / deployableCapital
      : 0;
    const sectorMap = allocations.reduce<Record<string, number>>((acc, row) => {
      acc[row.sector] = (acc[row.sector] ?? 0) + row.dollars;
      return acc;
    }, {});
    const sectorConcentration = Object.entries(sectorMap)
      .map(([sector, dollars]) => ({
        sector,
        pct: deployableCapital > 0 ? (dollars / deployableCapital) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 3);

    return {
      totalCapital,
      deployableCapital,
      cashReserve,
      topAllocations,
      weightedRisk,
      sectorConcentration,
    };
  }, [portfolioCapitalInput, portfolioHorizonFocus, portfolioRiskStyle, sortedRows]);

  const handleLogin = () => {
    if (!sitePassword) {
      setLoginError("Missing site password configuration.");
      return;
    }

    if (passwordInput === sitePassword) {
      setAuthenticated(true);
      localStorage.setItem("precision-dashboard-auth", "true");
      setPasswordInput("");
      setLoginError("");
      return;
    }

    setLoginError("Incorrect password.");
  };

  const addSymbol = async () => {
    const symbol = upper(newSymbol);
    if (!symbol) return;
    if (items.some((item) => item.symbol === symbol)) {
      setIntelligenceMessage(`${symbol} already exists.`);
      return;
    }

    setAdding(true);
    setIntelligenceMessage("");

    const row: Item = {
      symbol,
      bias: "Watch",
      price: 0,
      support: 0,
      resistance: 0,
      rsi: 50,
      volumeRatio: 1,
      technicalScore: 70,
      whaleScore: 60,
      macroScore: 60,
      politicalScore: 60,
      notes: ["New symbol added"],
    };
    const previousItems = items;
    const nextItems = [...items, row];

    setItems(nextItems);
    setSelectedSymbol(symbol);
    setNewSymbol("");

    try {
      if (!supabase) {
        localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(nextItems));
        setIntelligenceMessage(`${symbol} added (local fallback cache).`);
        return;
      }

      const { error } = await supabase
        .from(WATCHLIST_TABLE)
        .insert([mapItemToWatchlistPersistedRow(row)]);

      if (error) {
        setItems(previousItems);
        setIntelligenceMessage(error.message);
        return;
      }

      setIntelligenceMessage(`${symbol} added.`);
      localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(nextItems));
    } finally {
      setAdding(false);
    }
  };

  const removeSymbol = async (symbol: string) => {
    setDeletingSymbol(symbol);
    const previousItems = items;
    const updatedItems = items.filter((item) => item.symbol !== symbol);
    setItems(updatedItems);

    try {
      if (!supabase) {
        localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(updatedItems));
        setIntelligenceMessage(`${symbol} removed (local fallback cache).`);
        return;
      }

      const { error } = await supabase
        .from(WATCHLIST_TABLE)
        .delete()
        .eq("symbol", symbol);

      if (error) {
        setItems(previousItems);
        setIntelligenceMessage(error.message);
        return;
      }

      localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(updatedItems));
      setIntelligenceMessage(`${symbol} deleted.`);
    } finally {
      if (selectedSymbol === symbol) {
        setSelectedSymbol(updatedItems[0]?.symbol ?? "");
        setHistory([]);
        setQuoteMeta(null);
        setSentimentMeta(null);
      }
      setDeletingSymbol("");
    }
  };

  const refreshQuotesData = async () => {
    for (const row of items) {
      const res = await fetch(`/api/finnhub/quote?symbol=${encodeURIComponent(row.symbol)}`);
      const data: QuoteResponse = await res.json();
      if (!res.ok || data.error) continue;

      setItems((prev) =>
        prev.map((x) =>
          x.symbol === row.symbol
            ? {
                ...x,
                price: num(data.price, x.price),
                support: num(data.low, x.support),
                resistance: num(data.high, x.resistance),
                rsi:
                  data.percentChange > 3
                    ? 66
                    : data.percentChange > 1
                      ? 58
                      : data.percentChange < -3
                        ? 36
                        : 47,
                volumeRatio:
                  Math.abs(num(data.percentChange)) > 4
                    ? 2.1
                    : Math.abs(num(data.percentChange)) > 2
                      ? 1.7
                      : Math.max(1.1, num(x.volumeRatio, 1)),
              }
            : x
        )
      );

      if (selectedSymbol === row.symbol) {
        setQuoteMeta(data);
        setHistory((prev) => [
          ...prev.slice(-59),
          {
            time: new Date().toLocaleTimeString(),
            price: num(data.price),
          },
        ]);
      }
    }
  };

  const refreshTechnicalIndicatorsData = async () => {
    setItems((prev) =>
      prev.map((x) => ({
        ...x,
        technicalScore: Math.round(
          Math.max(0, Math.min(100, x.technicalScore * 0.7 + x.rsi * 0.3 + x.volumeRatio * 4))
        ),
      }))
    );
  };

  const refreshSentimentData = async () => {
    for (const row of items) {
      const res = await fetch(`/api/finnhub/sentiment?symbol=${encodeURIComponent(row.symbol)}`);
      const data: SentimentResponse = await res.json();
      if (!res.ok || data.error) continue;

      if (row.symbol === selectedSymbol) {
        setSentimentMeta(data);
      }

      setItems((prev) =>
        prev.map((x) => {
          if (x.symbol !== row.symbol) return x;

          const s = num(data.sentimentScore);
          return {
            ...x,
            politicalScore:
              s >= 72 ? Math.min(100, x.politicalScore + 6) : s <= 35 ? Math.max(0, x.politicalScore - 6) : x.politicalScore,
            technicalScore:
              s >= 76 ? Math.min(100, x.technicalScore + 3) : s <= 30 ? Math.max(0, x.technicalScore - 3) : x.technicalScore,
          };
        })
      );
    }
  };

  const refreshWhalesData = async () => {
    setItems((prev) =>
      prev.map((x) => ({
        ...x,
        whaleScore: Math.round(Math.max(0, Math.min(100, x.whaleScore * 0.7 + x.volumeRatio * 12 + x.rsi * 0.2))),
      }))
    );
  };

  const refreshMacroData = async () => {
    setItems((prev) =>
      prev.map((x) => ({
        ...x,
        macroScore: Math.round(Math.max(0, Math.min(100, x.macroScore * 0.8 + x.politicalScore * 0.2))),
      }))
    );
  };

  const recalculateHorizonScores = async () => {
    setItems((prev) => [...prev]);
  };

  const recalculateStrategyRecommendations = async () => {
    setItems((prev) => [...prev]);
  };

  const saveWatchlist = async (rows: Item[] = latestItemsRef.current) => {
    if (!supabase) {
      localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(rows));
      setIntelligenceMessage("Saved to local fallback cache.");
      return true;
    }

    const payload = rows.map((row) => ({
      ...mapItemToWatchlistPersistedRow(row),
    }));
    const payloadKeys = Array.from(
      payload.reduce<Set<string>>((keys, entry) => {
        Object.keys(entry).forEach((key) => keys.add(key));
        return keys;
      }, new Set<string>())
    ).sort();
    console.log("[watchlist.save] upsert payload keys:", payloadKeys);

    const { error } = await supabase.from(WATCHLIST_TABLE).upsert(payload, { onConflict: "symbol" });

    if (error) {
      setIntelligenceMessage(`Save failed: ${error.message}`);
      return false;
    }

    localStorage.setItem(WATCHLIST_CACHE_KEY, JSON.stringify(rows));
    setIntelligenceMessage("Watchlist saved.");
    return true;
  };

  const refreshIntelligence = async () => {
    if (!items.length) return;

    setRefreshingIntelligence(true);
    setIntelligenceMessage("Refreshing intelligence...");

    try {
      await refreshQuotesData();
      await refreshTechnicalIndicatorsData();
      await refreshSentimentData();
      await refreshWhalesData();
      await refreshMacroData();
      const symbols = items.map((entry) => entry.symbol);
      const intelligenceRes = await fetch("/api/intelligence/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols, force: true }),
      });

      if (intelligenceRes.ok) {
        const intelligenceData = (await intelligenceRes.json()) as IntelligenceApiResponse;
        const symbolMap = new Map(intelligenceData.items.map((entry) => [entry.symbol, entry]));
        let nextItems: Item[] = [];

        setItems((prev) =>
          (nextItems = prev.map((row) => {
            const summary = symbolMap.get(row.symbol);
            if (!summary) return row;
            const runtime = mapIntelligenceSummaryToRuntime(summary);

            return {
              ...row,
              ...runtime,
              bias: strategyToBias((summary.executionStrategy as Strategy) ?? summary.analyses[0]?.strategy ?? "Watch"),
            };
          }))
        );
        latestItemsRef.current = nextItems;
      }

      await recalculateHorizonScores();
      await recalculateStrategyRecommendations();
      const saved = await saveWatchlist();
      if (saved) {
        setLastRefresh(new Date().toLocaleTimeString());
        setIntelligenceMessage("Intelligence refreshed.");
      }
    } finally {
      setRefreshingIntelligence(false);
    }
  };

  const handleSaveButton = async () => {
    if (newSymbol.trim()) {
      await addSymbol();
      return;
    }

    setSavingEdits(true);
    try {
      await saveWatchlist();
    } finally {
      setSavingEdits(false);
    }
  };

  if (!authenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background:
            "radial-gradient(circle at top, #1e293b 0%, #0f172a 45%, #020617 100%)",
          color: "#e2e8f0",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 430,
            padding: 28,
            borderRadius: 20,
            background: "rgba(15,23,42,0.82)",
            border: "1px solid rgba(148,163,184,0.16)",
            boxShadow: "0 24px 80px rgba(2,6,23,0.46)",
            backdropFilter: "blur(12px)",
          }}
        >
          <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 1.4 }}>
            PRECISION SWING DASHBOARD V7.1
          </div>

          <h1 style={{ margin: "10px 0 8px 0", color: "#f8fafc" }}>
            TradingView Hybrid
          </h1>

          <p style={{ color: "#94a3b8", marginTop: 0 }}>
            Dark mode • smarter rankings • premium watchlist workflow
          </p>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            placeholder="Password"
            style={{
              width: "100%",
              padding: 12,
              marginTop: 12,
              borderRadius: 12,
              border: "1px solid rgba(148,163,184,0.18)",
              background: "#0f172a",
              color: "#fff",
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: 12,
              marginTop: 12,
              border: "none",
              borderRadius: 12,
              background: "linear-gradient(90deg, #2563eb, #38bdf8)",
              color: "#fff",
              fontWeight: 800,
              cursor: "pointer",
              boxShadow: "0 12px 32px rgba(37,99,235,0.34)",
            }}
          >
            Login
          </button>

          {loginError ? (
            <p style={{ color: "#f87171", marginTop: 12 }}>{loginError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "#e2e8f0",
          display: "grid",
          placeItems: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Loading watchlist...
      </div>
    );
  }

  if (!selectedItem || !selectedMetrics) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#020617",
          color: "#e2e8f0",
          display: "grid",
          placeItems: "center",
          fontFamily: "Arial, sans-serif",
        }}
      >
        No symbols found.
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: 24,
        maxWidth: 1850,
        margin: "0 auto",
        fontFamily: "Arial, sans-serif",
        color: "#e2e8f0",
        background:
          "radial-gradient(circle at top, #1e293b 0%, #0f172a 42%, #020617 100%)",
      }}
    >
      <div
        style={{
          ...panelStyle(),
          padding: 20,
          marginBottom: 18,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#38bdf8", letterSpacing: 1.3 }}>
            PRECISION SWING DASHBOARD V7.1
          </div>
          <h1 style={{ margin: "8px 0 6px 0", color: "#f8fafc" }}>
            TradingView Hybrid
          </h1>
          <div style={{ color: "#94a3b8", fontSize: 13 }}>
            Symbols: {items.length} • Last Refresh: {lastRefresh}
          </div>
        </div>

        <button
          onClick={() => void refreshIntelligence()}
          disabled={refreshingIntelligence}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            fontWeight: 800,
            background: refreshingIntelligence
              ? "#475569"
              : "linear-gradient(90deg, #2563eb, #38bdf8)",
            color: "#fff",
            boxShadow: "0 14px 36px rgba(37,99,235,0.28)",
          }}
        >
          {refreshingIntelligence ? "Refreshing..." : "Refresh Intelligence"}
        </button>
      </div>

      <div
        style={{
          ...panelStyle(),
          padding: 16,
          marginBottom: 18,
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ marginLeft: "auto" }}>
          <InfoHelp
            title="Intelligence Refresh"
            content="Use this control bar to refresh data and add symbols to your watchlist. Saved updates persist after reload."
            placement="bottom"
          />
        </div>
        <input
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Add symbol"
          style={{
            padding: 12,
            borderRadius: 12,
            border: "1px solid rgba(148,163,184,0.18)",
            background: "#0f172a",
            color: "#f8fafc",
            minWidth: 190,
          }}
        />

        <button
          onClick={() => void handleSaveButton()}
          disabled={adding || savingEdits}
          style={{
            padding: "12px 16px",
            borderRadius: 12,
            border: "none",
            background: "#16a34a",
            color: "#fff",
            cursor: "pointer",
            fontWeight: 800,
          }}
        >
          {adding || savingEdits ? "Saving..." : "Save"}
        </button>

        <span style={{ color: "#94a3b8", fontSize: 13 }}>
          {intelligenceMessage || "Each horizon is scored independently. Select a horizon to sort the watchlist."}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
          <InfoHelp
            title="Spotlight Cards"
            content="Spotlight shows the top 3 symbols for your selected analysis horizon. This does not merge horizons into a single model."
            placement="bottom"
          />
        </div>
        {spotlightRows.length ? (
          spotlightRows.map(({ item, metrics }, index) => (
            <div
              key={item.symbol}
              onClick={() => setSelectedSymbol(item.symbol)}
              style={{
                ...softCard(metrics.swingSignal),
                padding: 18,
                cursor: "pointer",
                position: "relative",
              }}
            >
              <div style={{ position: "absolute", top: 12, right: 12 }}>
                <InfoHelp
                  title={`${item.symbol} Spotlight`}
                  content={`This symbol is ranked in Spotlight because its ${HORIZON_OPTIONS.find((x) => x.key === watchlistHorizon)?.label ?? "selected"} score is ${toDisplayScore(engineScore(metrics, watchlistHorizon))}.`}
                  placement="left"
                  size={14}
                />
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                Spotlight #{index + 1}
              </div>
              <div
                style={{
                  marginTop: 6,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 28, fontWeight: 900, color: "#f8fafc" }}>
                  {item.symbol}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: signalColor(engineVerdict(metrics, watchlistHorizon)),
                    fontWeight: 800,
                  }}
                >
                  {HORIZON_OPTIONS.find((x) => x.key === watchlistHorizon)?.label} {toDisplayScore(engineScore(metrics, watchlistHorizon))}
                </div>
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontWeight: 800,
                  color: signalColor(metrics.swingSignal),
                }}
              >
                {metrics.swingSignal}
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1" }}>
                {metrics.swingStrategy} • Entry {metrics.entryZone}
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              ...panelStyle(),
              gridColumn: "1 / -1",
              padding: 16,
              color: "#cbd5e1",
              fontWeight: 700,
            }}
          >
            No deployable setups today
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 0.85fr",
          gap: 18,
        }}
      >
        <div style={{ ...panelStyle(), padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>SELECTED TICKER</div>
              <h2 style={{ margin: "6px 0 0 0", color: "#f8fafc" }}>
                {selectedItem.symbol}
              </h2>
            </div>
            <InfoHelp
              title="Selected Ticker Chart"
              content="This chart shows recent price movement for the selected ticker. Dashed levels mark support/resistance and trend references. Use 1D/5D/1M to change timeframe, read Bullish/Neutral/Bearish for short-term state, and use entry zones to improve timing."
              placement="left"
            />

            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "#0f172a",
                color: "#f8fafc",
              }}
            >
              {items.map((x) => (
                <option key={x.symbol} value={x.symbol}>
                  {x.symbol}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginTop: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: 8 }}>
                {(["1D", "5D", "1M"] as ChartRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setChartRange(range)}
                    style={{
                      borderRadius: 10,
                      border: "1px solid rgba(148,163,184,0.24)",
                      background: chartRange === range ? "rgba(56,189,248,0.18)" : "rgba(15,23,42,0.85)",
                      color: chartRange === range ? "#67e8f9" : "#cbd5e1",
                      padding: "6px 10px",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["Bullish", "Neutral", "Bearish"] as const).map((label) => (
                  <span
                    key={label}
                    style={{
                      borderRadius: 999,
                      padding: "4px 10px",
                      border: "1px solid rgba(148,163,184,0.2)",
                      fontSize: 12,
                      fontWeight: 800,
                      color: momentumLabel === label ? "#f8fafc" : "#94a3b8",
                      background:
                        momentumLabel === label
                          ? label === "Bullish"
                            ? "rgba(34,197,94,0.26)"
                            : label === "Bearish"
                            ? "rgba(239,68,68,0.24)"
                            : "rgba(245,158,11,0.24)"
                          : "rgba(15,23,42,0.7)",
                    }}
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                marginTop: 10,
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: 16,
                background: "#0f172a",
                padding: 10,
                position: "relative",
              }}
            >
              {chartStats ? (
                <>
                  <svg viewBox="0 0 760 280" style={{ width: "100%", height: 280, display: "block" }}>
                    <defs>
                      <linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor="rgba(56,189,248,0.30)" />
                        <stop offset="100%" stopColor="rgba(56,189,248,0.02)" />
                      </linearGradient>
                    </defs>
                    {chartSeries.length > 1 ? (
                      (() => {
                        const left = 36;
                        const top = 14;
                        const width = 700;
                        const height = 232;
                        const min = Math.min(chartStats.chartLow, chartStats.support, chartStats.stopValue ?? chartStats.chartLow);
                        const max = Math.max(chartStats.chartHigh, chartStats.resistance, chartStats.targetTwo ?? chartStats.chartHigh);
                        const safeRange = Math.max(0.01, max - min);
                        const toX = (index: number) => left + (index / Math.max(1, chartSeries.length - 1)) * width;
                        const toY = (value: number) => top + (1 - (value - min) / safeRange) * height;
                        const path = chartSeries.map((point, index) => `${index === 0 ? "M" : "L"}${toX(index)},${toY(point.price)}`).join(" ");
                        const areaPath = `${path} L${toX(chartSeries.length - 1)},${top + height} L${left},${top + height} Z`;
                        const entryRange = chartStats.entryRange;
                        const stopY = chartStats.stopValue ? toY(chartStats.stopValue) : null;
                        const targetY = chartStats.targetOne ? toY(chartStats.targetOne) : null;

                        return (
                          <g>
                            {entryRange ? (
                              <rect
                                x={left}
                                y={toY(entryRange[1])}
                                width={width}
                                height={Math.max(3, toY(entryRange[0]) - toY(entryRange[1]))}
                                fill="rgba(34,197,94,0.10)"
                              />
                            ) : null}
                            {stopY ? <rect x={left} y={stopY} width={width} height={top + height - stopY} fill="rgba(239,68,68,0.10)" /> : null}
                            {targetY ? <rect x={left} y={top} width={width} height={Math.max(2, targetY - top)} fill="rgba(59,130,246,0.08)" /> : null}

                            {[chartStats.support, chartStats.resistance, chartStats.lr50, chartStats.lr100, chartStats.vwap ?? null].map((lineValue, idx) => {
                              if (!lineValue) return null;
                              const y = toY(lineValue);
                              const colors = ["#22c55e", "#ef4444", "#f59e0b", "#a855f7", "#38bdf8"];
                              const dashes = ["6 5", "6 5", "3 4", "3 4", "2 4"];
                              return (
                                <line
                                  key={`${lineValue}-${idx}`}
                                  x1={left}
                                  x2={left + width}
                                  y1={y}
                                  y2={y}
                                  stroke={colors[idx]}
                                  strokeOpacity={0.82}
                                  strokeDasharray={dashes[idx]}
                                  strokeWidth={1.3}
                                />
                              );
                            })}

                            <path d={areaPath} fill="url(#chartFill)" />
                            <path d={path} fill="none" stroke="#38bdf8" strokeWidth={2.4} />
                            <circle cx={toX(chartSeries.length - 1)} cy={toY(chartSeries[chartSeries.length - 1].price)} r={4} fill={momentumColor} />
                          </g>
                        );
                      })()
                    ) : (
                      <g>
                        {[chartStats.support, chartStats.current, chartStats.resistance].map((level, index) => {
                          const y = 50 + index * 70;
                          return <line key={`${level}-${index}`} x1={36} x2={736} y1={y} y2={y} stroke="rgba(148,163,184,0.4)" strokeDasharray="6 4" />;
                        })}
                      </g>
                    )}
                  </svg>

                  <div style={{ position: "absolute", top: 12, right: 12, display: "grid", gap: 6 }}>
                    {[
                      ["Swing", selectedMetrics?.swing ?? 0],
                      ["3M", selectedMetrics?.threeMonth ?? 0],
                      ["6M", selectedMetrics?.sixMonth ?? 0],
                      ["1Y", selectedMetrics?.oneYear ?? 0],
                    ].map(([label, value]) => (
                      <span
                        key={String(label)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 10,
                          border: "1px solid rgba(148,163,184,0.2)",
                          background: "rgba(2,6,23,0.55)",
                          fontSize: 11,
                          color: "#cbd5e1",
                        }}
                      >
                        {label}: {toDisplayScore(Number(value))}
                      </span>
                    ))}
                  </div>
                </>
              ) : null}
            </div>

            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(5, minmax(120px, 1fr))", gap: 10 }}>
              {[
                ["Current", `$${num(selectedItem.price).toFixed(2)}`],
                ["Day High", `$${num(quoteMeta?.high, num(selectedItem.resistance)).toFixed(2)}`],
                ["Day Low", `$${num(quoteMeta?.low, num(selectedItem.support)).toFixed(2)}`],
                ["% Change", `${num(quoteMeta?.percentChange).toFixed(2)}%`],
                ["Vol vs Avg", `${Math.max(0.1, num(selectedItem.volumeRatio, 1)).toFixed(2)}x`],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ ...statCardStyle(), padding: 10 }}>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
                  <div style={{ marginTop: 4, fontSize: 15, fontWeight: 800, color: "#f8fafc" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(8, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <InfoHelp
                title="Price, Risk, Confidence, Momentum"
                content="Price is the latest quote. Risk combines volatility and downside exposure. Confidence reflects factor alignment. Momentum tracks short-term strength. Use all together before choosing an action."
                placement="bottom"
              />
            </div>
            {[
              ["Price", `$${selectedItem.price.toFixed(2)}`, "#f8fafc"],
              [
                "Signal",
                selectedDecision?.signal ?? "Neutral",
                selectedDecision?.signal === "Bullish" ? "#22c55e" : selectedDecision?.signal === "Bearish" ? "#ef4444" : "#f59e0b",
              ],
              ["Risk", selectedDecision?.risk ?? "Low", riskColor(selectedDecision?.risk ?? "Low")],
              ["Tradeability", selectedDecision?.tradeability ?? "Starter Size", "#38bdf8"],
              [
                "Confidence",
                `${selectedMetrics.confidencePercent}%`,
                selectedMetrics.confidenceLabel === "High"
                  ? "#22c55e"
                  : selectedMetrics.confidenceLabel === "Medium"
                  ? "#f59e0b"
                  : "#ef4444",
              ],
              ["Regime", selectedMetrics.marketRegime, "#f8fafc"],
              [
                "Momentum",
                selectedMetrics.momentumToday,
                scoreColor(selectedMetrics.momentumToday),
              ],
              ["Swing Score", toDisplayScore(selectedMetrics.swing), scoreColor(toDisplayScore(selectedMetrics.swing))],
            ].map((card) => (
              <div key={String(card[0])} style={statCardStyle()}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{card[0]}</div>
                <div
                  style={{
                    marginTop: 4,
                    fontWeight: 900,
                    fontSize: 18,
                    color: String(card[2]),
                  }}
                >
                  {card[1]}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(150px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <InfoHelp
                title="Horizon Cards"
                content="Swing, 3 Month, 6 Month, and 1 Year scores reflect different holding periods. Scores can differ because trend strength, risk, and macro factors change across timeframes."
                placement="bottom"
              />
            </div>
            {[
              {
                label: "Swing",
                score: selectedMetrics.swing,
                signal: selectedMetrics.recommendation,
                strategy: selectedMetrics.swingStrategy,
              },
              {
                label: "3 Month",
                score: selectedMetrics.threeMonth,
                signal: selectedMetrics.threeMonthSignal,
                strategy: selectedMetrics.threeMonthStrategy,
              },
              {
                label: "6 Month",
                score: selectedMetrics.sixMonth,
                signal: selectedMetrics.sixMonthSignal,
                strategy: selectedMetrics.sixMonthStrategy,
              },
              {
                label: "1 Year",
                score: selectedMetrics.oneYear,
                signal: selectedMetrics.oneYearSignal,
                strategy: selectedMetrics.oneYearStrategy,
              },
            ].map((card) => (
              <div
                key={card.label}
                style={{
                  ...softCard(card.signal),
                  padding: 14,
                }}
              >
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{card.label}</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: "#f8fafc" }}>
                  {card.score}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontWeight: 800,
                    color: signalColor(card.signal),
                  }}
                >
                  {card.signal}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, color: "#cbd5e1" }}>
                  {card.strategy}
                </div>
              </div>
            ))}
          </div>

          <div style={{ ...panelStyle(), padding: 16, marginTop: 18 }}>
            <SectionHelp
              title="Portfolio Allocation Engine"
              content="Deployable capital is what the system suggests putting to work now. Cash reserve is dry powder. Allocation sizing and sector concentration help avoid overexposure while keeping risk balanced."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(160px, 1fr))", gap: 10 }}>
              <label style={{ fontSize: 12, color: "#94a3b8" }}>
                Total Capital
                <input
                  value={portfolioCapitalInput}
                  onChange={(e) => setPortfolioCapitalInput(e.target.value)}
                  inputMode="decimal"
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "#0b1220",
                    color: "#f8fafc",
                  }}
                />
              </label>
              <label style={{ fontSize: 12, color: "#94a3b8" }}>
                Risk Style
                <select
                  value={portfolioRiskStyle}
                  onChange={(e) => setPortfolioRiskStyle(e.target.value as RiskStyle)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "#0b1220",
                    color: "#f8fafc",
                  }}
                >
                  {(["Conservative", "Balanced", "Aggressive"] as const).map((style) => (
                    <option key={style} value={style}>
                      {style}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ fontSize: 12, color: "#94a3b8" }}>
                Horizon Focus
                <select
                  value={portfolioHorizonFocus}
                  onChange={(e) => setPortfolioHorizonFocus(e.target.value as HorizonFocus)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.2)",
                    background: "#0b1220",
                    color: "#f8fafc",
                  }}
                >
                  {(["Swing", "3 Month", "6 Month", "1 Year"] as const).map((focus) => (
                    <option key={focus} value={focus}>
                      {focus}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 10 }}>
              <div style={statCardStyle()}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Deployable Capital</div>
                <div style={{ marginTop: 4, fontWeight: 900, fontSize: 19, color: "#67e8f9" }}>
                  ${portfolioPlan.deployableCapital.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
              <div style={statCardStyle()}>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>Cash Reserve</div>
                <div style={{ marginTop: 4, fontWeight: 900, fontSize: 19, color: "#cbd5e1" }}>
                  ${portfolioPlan.cashReserve.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <h4 style={{ margin: "0 0 8px 0", color: "#f8fafc" }}>Top Recommended Allocations</h4>
              {portfolioPlan.topAllocations.length ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {portfolioPlan.topAllocations.map((allocation) => (
                    <div
                      key={allocation.symbol}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.1fr 0.8fr 0.9fr 1.2fr",
                        gap: 8,
                        padding: "10px 12px",
                        borderRadius: 12,
                        border: "1px solid rgba(148,163,184,0.14)",
                        background: "rgba(15,23,42,0.8)",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ fontWeight: 800, color: "#f8fafc" }}>{allocation.symbol}</div>
                      <div style={{ color: "#67e8f9", fontWeight: 700 }}>
                        ${allocation.dollars.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </div>
                      <div style={{ color: "#cbd5e1", fontSize: 13 }}>{allocation.vehicle}</div>
                      <div style={{ color: riskColor(allocation.riskLabel), fontSize: 13 }}>
                        {allocation.riskLabel} • {allocation.strategy}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "#94a3b8", margin: 0 }}>No deployable allocations available.</p>
              )}
            </div>

            <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                <b>Risk Summary:</b> Weighted portfolio risk score {portfolioPlan.weightedRisk.toFixed(1)} / 10
              </div>
              <div style={{ color: "#cbd5e1", fontSize: 13 }}>
                <b>Sector Concentration:</b>{" "}
                {portfolioPlan.sectorConcentration.length
                  ? portfolioPlan.sectorConcentration
                      .map((x) => `${x.sector} ${x.pct.toFixed(0)}%`)
                      .join(" • ")
                  : "Not enough data"}
              </div>
            </div>
          </div>

        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...panelStyle(), padding: 16 }}>
            <SectionHelp
              title="Trade Plan"
              heading="h4"
              content="Entry zone helps avoid chasing price. Stop loss defines your planned downside. Targets help you scale profits, and position size helps control total portfolio risk."
            />
            <p><b>Entry Zone:</b> {selectedMetrics.entryZone}</p>
            <p><b>Stop Loss:</b> {selectedMetrics.stopLoss}</p>
            <p><b>Target 1:</b> {selectedMetrics.target1}</p>
            <p><b>Target 2:</b> {selectedMetrics.target2}</p>
            <p><b>Position Size:</b> {selectedMetrics.positionSizing}</p>
          </div>

          <div style={{ ...panelStyle(), padding: 16 }}>
            <SectionHelp
              title="Options Engine"
              heading="h4"
              content="These notes explain why the system favors shares, calls, or puts. Breakout confirmation means price strength is proving itself. Calls can be avoided when risk or timing uncertainty is elevated."
            />
            <p><b>Action:</b> {selectedMetrics.strategy}</p>
            <p><b>Signal:</b> {selectedDecision?.signal ?? "Neutral"}</p>
            <p><b>Risk:</b> {selectedDecision?.risk ?? "Low"}</p>
            <p><b>Tradeability:</b> {selectedDecision?.tradeability ?? "Starter Size"}</p>
            <p><b>Calls:</b> {selectedMetrics.callPlan}</p>
            <p><b>Puts:</b> {selectedMetrics.putPlan}</p>
            <p><b>Session:</b> {quoteMeta?.session ?? "-"}</p>
            <p><b>Trend:</b> {quoteMeta?.trend ?? "-"}</p>
            <p><b>Day Range %:</b> {num(quoteMeta?.dayRangePercent).toFixed(2)}</p>
          </div>

          <div style={{ ...panelStyle(), padding: 16 }}>
            <SectionHelp
              title="Model Notes"
              heading="h4"
              content="This summarizes the reasoning engine: fundamentals, technicals, sector context, and macro context. Use it as plain-language support for the current recommendation."
            />
            <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
              <li>{selectedMetrics.reason}</li>
              {selectedMetrics.notes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          </div>

          <div style={{ ...panelStyle(), padding: 18 }}>
            <SectionHelp
              title="Catalysts & Headlines"
              content="News and catalysts can quickly change momentum, risk, and ranking. Treat this section as a fast check before entering or adding to a position."
            />

            {sentimentMeta?.topHeadlines?.length ? (
              <div>
                {sentimentMeta.topHeadlines.slice(0, 5).map((x, i) => (
                  <div
                    key={i}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(148,163,184,0.1)",
                    }}
                  >
                    <div style={{ fontWeight: 700, color: "#e2e8f0" }}>
                      {x.headline}
                    </div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>
                      {x.source ?? ""} {x.score ? `• Score ${x.score}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: "#94a3b8" }}>
                Use Refresh Intelligence to load headline analysis.
              </p>
            )}
          </div>

        </div>
      </div>

      <div
        style={{
          ...panelStyle(),
          padding: 18,
          marginTop: 18,
          overflowX: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <label style={{ color: "#cbd5e1", fontSize: 13 }}>Sort Watchlist By:</label>
            <select
              value={watchlistHorizon}
              onChange={(e) => setWatchlistHorizon(e.target.value as EngineKey)}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "#0f172a",
                color: "#f8fafc",
                fontWeight: 700,
              }}
            >
              {HORIZON_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <InfoHelp
            title="Horizon Engines"
            content="Swing, 3 Month, 6 Month, and 1 Year+ are independent engines with separate weights. Symbols can be Buy in one horizon and Watch in another."
            placement="bottom"
          />
        </div>

        <div style={{ marginBottom: 18 }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Independent Horizon Engine Watchlist</h3>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
                minWidth: 1320,
                color: "#e2e8f0",
              }}
            >
              <thead>
                <tr style={{ background: "rgba(30,41,59,0.72)" }}>
                  <th style={{ padding: 9, textAlign: "left" }}>Ticker</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Swing Score / Verdict</th>
                  <th style={{ padding: 9, textAlign: "center" }}>3M Score / Verdict</th>
                  <th style={{ padding: 9, textAlign: "center" }}>6M Score / Verdict</th>
                  <th style={{ padding: 9, textAlign: "center" }}>1Y+ Score / Verdict</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Best Strategy</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Signal</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Risk</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Tradeability</th>
                  <th style={{ padding: 9, textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map(({ item, metrics }) => {
              const decision = buildDecision(metrics, watchlistHorizon);
              return (
              <tr
                key={item.symbol}
                style={{
                  borderBottom: "1px solid rgba(148,163,184,0.09)",
                  background:
                    item.symbol === selectedSymbol
                      ? "rgba(37,99,235,0.10)"
                      : "transparent",
                  opacity: num(item.price) <= 0 ? 0.7 : 1,
                }}
              >
                <td
                  style={{
                    padding: 9,
                    fontWeight: 800,
                    cursor: "pointer",
                    color: "#f8fafc",
                  }}
                  onClick={() => setSelectedSymbol(item.symbol)}
                >
                  {item.symbol}
                </td>

                <td style={{ padding: 9, textAlign: "center", fontWeight: 900, color: scoreColor(toDisplayScore(metrics.swing)) }}>
                  {toDisplayScore(metrics.swing)} • <span style={{ color: signalColor(metrics.swingSignal) }}>{metrics.swingSignal}</span>
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: scoreColor(toDisplayScore(metrics.threeMonth)),
                  }}
                >
                  {toDisplayScore(metrics.threeMonth)} • <span style={{ color: signalColor(metrics.threeMonthSignal) }}>{metrics.threeMonthSignal}</span>
                </td>
                <td style={{ padding: 9, textAlign: "center", fontWeight: 900, color: scoreColor(toDisplayScore(metrics.sixMonth)) }}>
                  {toDisplayScore(metrics.sixMonth)} • <span style={{ color: signalColor(metrics.sixMonthSignal) }}>{metrics.sixMonthSignal}</span>
                </td>

                <td style={{ padding: 9, textAlign: "center", fontWeight: 900, color: scoreColor(toDisplayScore(metrics.oneYear)) }}>
                  {toDisplayScore(metrics.oneYear)} • <span style={{ color: signalColor(metrics.oneYearSignal) }}>{metrics.oneYearSignal}</span>
                </td>
                <td style={{ padding: 9, textAlign: "center", fontWeight: 800 }}>
                  {bestStrategy(metrics)}
                </td>
                <td style={{ padding: 9, textAlign: "center", fontWeight: 800, color: decision.signal === "Bullish" ? "#22c55e" : decision.signal === "Bearish" ? "#ef4444" : "#f59e0b" }}>{decision.signal}</td>
                <td style={{ padding: 9, textAlign: "center", fontWeight: 800, color: riskColor(decision.risk) }}>{decision.risk}</td>
                <td style={{ padding: 9, textAlign: "center", fontWeight: 800 }}>{decision.tradeability}</td>

                <td style={{ padding: 9, textAlign: "center" }}>
                  <button
                    onClick={() => void removeSymbol(item.symbol)}
                    disabled={deletingSymbol === item.symbol}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 8,
                      border: "1px solid rgba(148,163,184,0.18)",
                      background: "#0f172a",
                      color: "#e2e8f0",
                      cursor: "pointer",
                    }}
                  >
                    {deletingSymbol === item.symbol ? "Deleting..." : "Delete"}
                  </button>
                </td>
              </tr>
              );
                })}
              </tbody>
            </table>
            {!sortedRows.length ? (
              <p style={{ color: "#94a3b8", marginTop: 8 }}>No symbols in watchlist.</p>
            ) : null}
          </div>
      </div>
    </div>
  );
}

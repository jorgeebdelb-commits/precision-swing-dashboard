"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  Item,
  QuoteResponse,
  SentimentResponse,
  SortKey,
} from "@/types/dashboard";
import { computeMetrics, type RowMetrics } from "@/engines/strategy";
import { watchlist as seedWatchlist } from "@/app/lib/watchlist";
import { supabase } from "@/app/lib/supabase";
import { num, upper } from "@/app/lib/helpers";

type RowData = {
  item: Item;
  metrics: RowMetrics;
};

function glowColor(score: number) {
  if (score >= 80) return "#22c55e";
  if (score >= 65) return "#f59e0b";
  return "#ef4444";
}

function signalColor(signal: string) {
  if (signal === "Strong Buy") return "#22c55e";
  if (signal === "Buy") return "#4ade80";
  if (signal === "Watch") return "#f59e0b";
  if (signal === "Caution") return "#fb923c";
  return "#ef4444";
}

function riskColor(risk: "Unknown" | "Low" | "Medium" | "High" | "Extreme") {
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

export default function DashboardClientShell() {
  const sitePassword = process.env.NEXT_PUBLIC_SITE_PASSWORD ?? "";

  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [items, setItems] = useState<Item[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [newSymbol, setNewSymbol] = useState("");

  const [loading, setLoading] = useState(true);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [refreshingAll, setRefreshingAll] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState("");

  const [quoteMessage, setQuoteMessage] = useState("");
  const [sentimentMessage, setSentimentMessage] = useState("");
  const [lastRefresh, setLastRefresh] = useState("-");

  const [quoteMeta, setQuoteMeta] = useState<QuoteResponse | null>(null);
  const [sentimentMeta, setSentimentMeta] =
    useState<SentimentResponse | null>(null);

  const [history, setHistory] = useState<{ time: string; price: number }[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("swing");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const chartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const unlocked = localStorage.getItem("precision-dashboard-auth");
    if (unlocked === "true") setAuthenticated(true);
  }, []);

  useEffect(() => {
    const loadWatchlist = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("*")
          .order("created_at", { ascending: true });

        if (error || !data || data.length === 0) {
          setItems(seedWatchlist);
          setSelectedSymbol(seedWatchlist[0]?.symbol ?? "");
          return;
        }

        const mapped: Item[] = data
          .map((row: Record<string, unknown>) => {
            const getValue = (...keys: string[]) => {
              for (const key of keys) {
                if (row[key] !== undefined) return row[key];
              }
              return undefined;
            };
            const toOptionalNumber = (...keys: string[]) => {
              const value = getValue(...keys);
              return value === undefined ? undefined : num(value);
            };

            const rawBias = row.bias;
            const bias: Item["bias"] =
              rawBias === "Bullish" || rawBias === "Bearish" || rawBias === "Watch"
                ? rawBias
                : "Watch";

            return {
              symbol: typeof row.symbol === "string" ? row.symbol : "",
              bias,
              price: num(getValue("price", "last_price")),
              support: num(getValue("support")),
              resistance: num(getValue("resistance")),
              rsi: num(getValue("rsi"), 50),
              volumeRatio: num(getValue("volumeRatio", "volume_ratio"), 1),
              technicalScore: num(
                getValue("technicalScore", "technical_score", "tech"),
                70
              ),
              whaleScore: num(getValue("whaleScore", "whale_score", "intel"), 60),
              macroScore: num(getValue("macroScore", "macro_score"), 60),
              politicalScore: num(getValue("politicalScore", "political_score", "env"), 60),
              lr50: toOptionalNumber("lr50", "lr_50"),
              lr50Slope: toOptionalNumber("lr50Slope", "lr_50_slope"),
              lr100: toOptionalNumber("lr100", "lr_100"),
              lr100Slope: toOptionalNumber("lr100Slope", "lr_100_slope"),
              fibSupport: toOptionalNumber("fibSupport", "fib_support"),
              fibResistance: toOptionalNumber("fibResistance", "fib_resistance"),
              atrPercent: toOptionalNumber("atrPercent", "atr_percent"),
              betaProxy: toOptionalNumber("betaProxy", "beta_proxy"),
              priceVolatility: toOptionalNumber("priceVolatility", "price_volatility"),
              ivPercentile: toOptionalNumber("ivPercentile", "iv_percentile"),
              earningsDays: toOptionalNumber("earningsDays", "earnings_days"),
              notes: Array.isArray(row.notes)
                ? row.notes.filter((note): note is string => typeof note === "string")
                : [],
            };
          })
          .filter((item) => item.symbol);

        setItems(mapped);
        setSelectedSymbol(mapped[0]?.symbol ?? "");
      } finally {
        setLoading(false);
      }
    };

    void loadWatchlist();
  }, []);

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

  const redRows = useMemo(() => rows.filter((x) => x.metrics.redFlag), [rows]);
  const unknownRiskRows = useMemo(
    () =>
      rows.filter(
        (x) =>
          x.item.atrPercent === undefined ||
          x.item.priceVolatility === undefined ||
          x.item.betaProxy === undefined
      ),
    [rows]
  );

  const topThree = useMemo(
    () =>
      [...rows]
        .filter((x) => num(x.item.price) > 0)
        .sort((a, b) => b.metrics.swing - a.metrics.swing)
        .slice(0, 3),
    [rows]
  );

  const avgSwing = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round(
      rows.reduce((sum, row) => sum + row.metrics.swing, 0) / rows.length
    );
  }, [rows]);

  const avgConfidence = useMemo(() => {
    if (!rows.length) return 0;
    return Math.round(
      rows.reduce((sum, row) => sum + row.metrics.confidence, 0) /
        rows.length
    );
  }, [rows]);

  const sortedRows = useMemo(() => {
    const copy = [...rows];

    const getValue = (row: RowData) => {
      if (sortKey === "symbol") return row.item.symbol;
      if (sortKey === "price") return row.item.price;
      if (sortKey === "technical") return row.metrics.technical;
      if (sortKey === "fundamental") return row.metrics.fundamental;
      if (sortKey === "intelligence") return row.metrics.intelligence;
      if (sortKey === "environment") return row.metrics.environment;
      if (sortKey === "swing") return row.metrics.swing;
      if (sortKey === "threeMonth") return row.metrics.threeMonth;
      if (sortKey === "sixMonth") return row.metrics.sixMonth;
      if (sortKey === "oneYear") return row.metrics.oneYear;
      if (sortKey === "riskScore") return row.metrics.riskScore;
      if (sortKey === "confidence") return row.metrics.confidence;
      if (sortKey === "bestStrategy") return row.metrics.bestStrategy;
      return row.metrics.swing;
    };

    copy.sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);

      if (typeof av === "string" && typeof bv === "string") {
        return sortDirection === "asc"
          ? av.localeCompare(bv)
          : bv.localeCompare(av);
      }

      return sortDirection === "asc" ? num(av) - num(bv) : num(bv) - num(av);
    });

    return copy;
  }, [rows, sortDirection, sortKey]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "symbol" ? "asc" : "desc");
  };

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

    setAdding(true);
    setQuoteMessage("");

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

    try {
      const { error } = await supabase.from("watchlist").upsert(
        [
          {
            symbol: row.symbol,
            bias: row.bias,
            price: row.price,
            support: row.support,
            resistance: row.resistance,
            rsi: row.rsi,
            volumeRatio: row.volumeRatio,
            technicalScore: row.technicalScore,
            whaleScore: row.whaleScore,
            macroScore: row.macroScore,
            politicalScore: row.politicalScore,
            notes: row.notes,
          },
        ],
        { onConflict: "symbol" }
      );

      if (error) {
        setQuoteMessage(error.message);
        return;
      }

      setItems((prev) => {
        const exists = prev.some((x) => x.symbol === symbol);
        if (exists) return prev;
        return [...prev, row];
      });

      setSelectedSymbol(symbol);
      setNewSymbol("");
      setQuoteMessage(`${symbol} saved.`);
    } finally {
      setAdding(false);
    }
  };

  const removeSymbol = async (symbol: string) => {
    setDeletingSymbol(symbol);

    try {
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("symbol", symbol);

      if (error) {
        setQuoteMessage(error.message);
        return;
      }

      setItems((prev) => {
        const updated = prev.filter((x) => x.symbol !== symbol);

        if (selectedSymbol === symbol) {
          setSelectedSymbol(updated[0]?.symbol ?? "");
          setHistory([]);
          setQuoteMeta(null);
          setSentimentMeta(null);
        }

        return updated;
      });

      setQuoteMessage(`${symbol} deleted.`);
    } finally {
      setDeletingSymbol("");
    }
  };

  const refreshQuote = async (sym?: string) => {
    const symbol = sym ?? selectedSymbol;
    if (!symbol) return;

    setLoadingQuote(true);

    try {
      const res = await fetch(
        `/api/finnhub/quote?symbol=${encodeURIComponent(symbol)}`
      );

      const data: QuoteResponse = await res.json();

      if (!res.ok || data.error) {
        setQuoteMessage("Quote failed.");
        return;
      }

      setQuoteMeta(data);
      setLastRefresh(new Date().toLocaleTimeString());

      setItems((prev) =>
        prev.map((x) =>
          x.symbol === symbol
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

      await supabase
        .from("watchlist")
        .update({
          price: num(data.price),
          support: num(data.low),
          resistance: num(data.high),
        })
        .eq("symbol", symbol);

      setHistory((prev) => [
        ...prev.slice(-59),
        {
          time: new Date().toLocaleTimeString(),
          price: num(data.price),
        },
      ]);

      setQuoteMessage(`${symbol} quote updated.`);
    } finally {
      setLoadingQuote(false);
    }
  };

  const refreshAll = async () => {
    if (!items.length) return;

    setRefreshingAll(true);
    setQuoteMessage("Refreshing all quotes...");

    try {
      for (const row of items) {
        await refreshQuote(row.symbol);
      }
      setQuoteMessage("All quotes refreshed.");
    } finally {
      setRefreshingAll(false);
    }
  };

  const refreshSentiment = async () => {
    if (!selectedSymbol) return;

    setLoadingSentiment(true);

    try {
      const res = await fetch(
        `/api/finnhub/sentiment?symbol=${encodeURIComponent(selectedSymbol)}`
      );

      const data: SentimentResponse = await res.json();

      if (!res.ok || data.error) {
        setSentimentMessage("Sentiment failed.");
        return;
      }

      setSentimentMeta(data);

      setItems((prev) =>
        prev.map((x) => {
          if (x.symbol !== selectedSymbol) return x;

          const s = num(data.sentimentScore);
          return {
            ...x,
            politicalScore:
              s >= 72
                ? Math.min(100, x.politicalScore + 6)
                : s <= 35
                ? Math.max(0, x.politicalScore - 6)
                : x.politicalScore,
            technicalScore:
              s >= 76
                ? Math.min(100, x.technicalScore + 3)
                : s <= 30
                ? Math.max(0, x.technicalScore - 3)
                : x.technicalScore,
          };
        })
      );

      setSentimentMessage(
        `${selectedSymbol} sentiment: ${data.sentimentLabel} (${data.sentimentScore})`
      );
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (!authenticated || !selectedSymbol) return;

    setHistory([]);
    void refreshQuote(selectedSymbol);

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshQuote(selectedSymbol);
      }
    }, 15000);

    return () => clearInterval(timer);
  }, [authenticated, selectedSymbol]);

  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#0f172a");
    bg.addColorStop(1, "#111827");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (history.length < 2) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "14px Arial";
      ctx.fillText("Waiting for live data...", 24, 38);
      return;
    }

    const prices = history.map((x) => x.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = 24;

    ctx.strokeStyle = "rgba(148,163,184,0.18)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const y = pad + (i / 3) * (height - pad * 2);
      ctx.beginPath();
      ctx.moveTo(pad, y);
      ctx.lineTo(width - pad, y);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2.4;

    history.forEach((point, i) => {
      const x = pad + (i / (history.length - 1)) * (width - pad * 2);
      const y =
        height - pad - ((point.price - min) / range) * (height - pad * 2);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    const last = history[history.length - 1];
    const lastX = width - pad;
    const lastY =
      height - pad - ((last.price - min) / range) * (height - pad * 2);

    ctx.beginPath();
    ctx.fillStyle = "#22c55e";
    ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#cbd5e1";
    ctx.font = "12px Arial";
    ctx.fillText(`Low ${min.toFixed(2)}`, 12, height - 8);
    ctx.fillText(`High ${max.toFixed(2)}`, width - 92, 16);
  }, [history]);

  const renderSortButton = (label: string, key: SortKey) => (
    <button
      onClick={() => handleSort(key)}
      style={{
        border: "none",
        background: "transparent",
        fontWeight: 800,
        color: "#cbd5e1",
        cursor: "pointer",
        padding: 0,
      }}
    >
      {label}
      {sortKey === key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
    </button>
  );

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
          onClick={() => void refreshAll()}
          disabled={refreshingAll}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            fontWeight: 800,
            background: refreshingAll
              ? "#475569"
              : "linear-gradient(90deg, #2563eb, #38bdf8)",
            color: "#fff",
            boxShadow: "0 14px 36px rgba(37,99,235,0.28)",
          }}
        >
          {refreshingAll ? "Refreshing..." : "Refresh All"}
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
          onClick={addSymbol}
          disabled={adding}
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
          {adding ? "Saving..." : "Save"}
        </button>

        <span style={{ color: "#94a3b8", fontSize: 13 }}>
          {quoteMessage || sentimentMessage || "Swing score is the default ranking."}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(180px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div style={{ ...panelStyle(), padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Red Flags</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#ef4444" }}>
            {redRows.length}
          </div>
        </div>

        <div style={{ ...panelStyle(), padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Unknown Risk</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#94a3b8" }}>
            {unknownRiskRows.length}
          </div>
        </div>

        <div style={{ ...panelStyle(), padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Avg Swing</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#f8fafc" }}>
            {avgSwing}
          </div>
        </div>

        <div style={{ ...panelStyle(), padding: 16 }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Avg Confidence</div>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#38bdf8" }}>
            {avgConfidence}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(240px, 1fr))",
          gap: 14,
          marginBottom: 18,
        }}
      >
        {(topThree.length ? topThree : rows.slice(0, 3)).map(
          ({ item, metrics }, index) => (
            <div
              key={item.symbol}
              onClick={() => setSelectedSymbol(item.symbol)}
              style={{
                ...softCard(metrics.swingSignal),
                padding: 18,
                cursor: "pointer",
              }}
            >
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
                    color: signalColor(metrics.swingSignal),
                    fontWeight: 800,
                  }}
                >
                  Swing {metrics.swing.toFixed(1)}
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
                {metrics.bestStrategy} • Entry {metrics.entryZone}
              </div>
            </div>
          )
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
            <canvas
              ref={chartRef}
              width={760}
              height={260}
              style={{
                width: "100%",
                height: 260,
                border: "1px solid rgba(148,163,184,0.12)",
                borderRadius: 16,
                background: "#0f172a",
              }}
            />
          </div>

          <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => void refreshQuote()}
              disabled={loadingQuote}
              style={{
                padding: "11px 15px",
                borderRadius: 12,
                border: "none",
                background: "#2563eb",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {loadingQuote ? "Loading..." : "Refresh Quote"}
            </button>

            <button
              onClick={() => void refreshSentiment()}
              disabled={loadingSentiment}
              style={{
                padding: "11px 15px",
                borderRadius: 12,
                border: "none",
                background: "#7c3aed",
                color: "#fff",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              {loadingSentiment ? "Loading..." : "Refresh Sentiment"}
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(6, minmax(120px, 1fr))",
              gap: 12,
            }}
          >
            {[
              ["Price", `$${selectedItem.price.toFixed(2)}`, "#f8fafc"],
              ["Risk", selectedMetrics.riskLabel, riskColor(selectedMetrics.riskLabel)],
              [
                "Confidence",
                selectedMetrics.confidence.toFixed(1),
                glowColor(selectedMetrics.confidence * 10),
              ],
              ["Regime", selectedMetrics.marketRegime, "#f8fafc"],
              [
                "Momentum",
                selectedMetrics.momentumToday,
                glowColor(selectedMetrics.momentumToday),
              ],
              ["Best", selectedMetrics.bestStrategy, "#38bdf8"],
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
            {[
              {
                label: "Swing",
                score: selectedMetrics.swing,
                signal: selectedMetrics.swingSignal,
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

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(220px, 1fr))",
              gap: 12,
            }}
          >
            <div style={{ ...panelStyle(), padding: 16 }}>
              <h4 style={{ marginTop: 0, color: "#f8fafc" }}>Trade Plan</h4>
              <p><b>Entry Zone:</b> {selectedMetrics.entryZone}</p>
              <p><b>Stop Loss:</b> {selectedMetrics.stopLoss}</p>
              <p><b>Target 1:</b> {selectedMetrics.target1}</p>
              <p><b>Target 2:</b> {selectedMetrics.target2}</p>
              <p><b>Position Size:</b> {selectedMetrics.positionSizing}</p>
            </div>

            <div style={{ ...panelStyle(), padding: 16 }}>
              <h4 style={{ marginTop: 0, color: "#f8fafc" }}>Options Engine</h4>
              <p><b>Calls:</b> {selectedMetrics.callPlan}</p>
              <p><b>Puts:</b> {selectedMetrics.putPlan}</p>
              <p><b>Session:</b> {quoteMeta?.session ?? "-"}</p>
              <p><b>Trend:</b> {quoteMeta?.trend ?? "-"}</p>
              <p><b>Day Range %:</b> {num(quoteMeta?.dayRangePercent).toFixed(2)}</p>
            </div>
          </div>

          {selectedMetrics.notes.length ? (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                background: "rgba(30,41,59,0.72)",
                border: "1px solid rgba(148,163,184,0.14)",
              }}
            >
              <b style={{ color: "#f8fafc" }}>Model Notes</b>
              <ul style={{ marginBottom: 0, color: "#cbd5e1" }}>
                {selectedMetrics.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ ...panelStyle(), padding: 18 }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Catalysts & Headlines</h3>

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
                Refresh sentiment to load headline analysis.
              </p>
            )}
          </div>

          <div style={{ ...panelStyle(), padding: 18 }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Focus List</h3>
            {topThree.length ? (
              topThree.map(({ item, metrics }) => (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: "#f8fafc" }}>{item.symbol}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {metrics.swingSignal} • {metrics.bestStrategy} • Risk {metrics.riskLabel}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: "#22c55e" }}>
                    {metrics.swing.toFixed(1)}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#94a3b8" }}>No ranked symbols yet.</p>
            )}
          </div>

          <div style={{ ...panelStyle(), padding: 18 }}>
            <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Red Flags</h3>
            {redRows.length ? (
              redRows.slice(0, 5).map(({ item, metrics }) => (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedSymbol(item.symbol)}
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(148,163,184,0.1)",
                    cursor: "pointer",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 800, color: "#f8fafc" }}>{item.symbol}</div>
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>
                      {metrics.notes[0] ?? "Needs review"}
                    </div>
                  </div>
                  <div style={{ fontWeight: 800, color: "#ef4444" }}>
                    {metrics.riskLabel}
                  </div>
                </div>
              ))
            ) : (
              <p style={{ color: "#94a3b8" }}>No major red flags detected.</p>
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
        <h3 style={{ marginTop: 0, color: "#f8fafc" }}>Sortable Opportunities</h3>

        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 13,
            minWidth: 1680,
            color: "#e2e8f0",
          }}
        >
          <thead>
            <tr style={{ background: "rgba(30,41,59,0.72)" }}>
              <th style={{ padding: 9, textAlign: "left" }}>
                {renderSortButton("Ticker", "symbol")}
              </th>
              <th style={{ padding: 9, textAlign: "right" }}>
                {renderSortButton("Price", "price")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Tech", "technical")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Fund", "fundamental")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Intel", "intelligence")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Env", "environment")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Swing", "swing")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("3M", "threeMonth")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("6M", "sixMonth")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("1Y", "oneYear")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Risk", "riskScore")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Confidence", "confidence")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>
                {renderSortButton("Best", "bestStrategy")}
              </th>
              <th style={{ padding: 9, textAlign: "center" }}>Why</th>
              <th style={{ padding: 9, textAlign: "center" }}>Action</th>
            </tr>
          </thead>

          <tbody>
            {sortedRows.map(({ item, metrics }) => (
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

                <td style={{ padding: 9, textAlign: "right" }}>
                  ${num(item.price).toFixed(2)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: glowColor(metrics.technical * 10),
                  }}
                >
                  {metrics.technical.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: glowColor(metrics.fundamental * 10),
                  }}
                >
                  {metrics.fundamental.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: glowColor(metrics.intelligence * 10),
                  }}
                >
                  {metrics.intelligence.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: glowColor(metrics.environment * 10),
                  }}
                >
                  {metrics.environment.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: signalColor(metrics.swingSignal),
                  }}
                >
                  {metrics.swing.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: signalColor(metrics.threeMonthSignal),
                  }}
                >
                  {metrics.threeMonth.toFixed(1)}
                </td>

                <td style={{ padding: 9, textAlign: "center", fontWeight: 900 }}>
                  {metrics.sixMonth.toFixed(1)}
                </td>

                <td style={{ padding: 9, textAlign: "center", fontWeight: 900 }}>
                  {metrics.oneYear.toFixed(1)}
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: riskColor(metrics.riskLabel),
                  }}
                >
                  {metrics.riskLabel} ({metrics.riskScore})
                </td>

                <td
                  style={{
                    padding: 9,
                    textAlign: "center",
                    fontWeight: 900,
                    color: glowColor(metrics.confidence * 10),
                  }}
                >
                  {metrics.confidence.toFixed(1)}
                </td>

                <td style={{ padding: 9, textAlign: "center", fontWeight: 800 }}>
                  {metrics.bestStrategy}
                </td>

                <td style={{ padding: 9, textAlign: "left", maxWidth: 260 }}>
                  {metrics.why.join(" • ")}
                </td>

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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

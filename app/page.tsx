"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  watchlist as initialWatchlist,
  type WatchlistItem,
} from "./lib/watchlist";
import { supabase } from "./lib/supabase";

type Item = WatchlistItem;

type QuoteResponse = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: number;
  error?: string;
};

type SentimentResponse = {
  symbol: string;
  sentimentScore: number;
  newsCount: number;
  sentimentLabel?: string;
  rawScore?: number;
  error?: string;
};

const num = (v: unknown, d = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

const clamp = (v: unknown): number => Math.max(0, Math.min(100, num(v)));

export default function Dashboard() {
  const sitePassword = process.env.NEXT_PUBLIC_SITE_PASSWORD ?? "";

  const [authenticated, setAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [loginError, setLoginError] = useState("");

  const [list, setList] = useState<Item[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [newSymbol, setNewSymbol] = useState("");

  const [quoteMessage, setQuoteMessage] = useState("");
  const [sentimentMessage, setSentimentMessage] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [loadingWatchlist, setLoadingWatchlist] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingSymbol, setDeletingSymbol] = useState<string | null>(null);

  const [history, setHistory] = useState<{ time: string; price: number }[]>([]);
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const unlocked = localStorage.getItem("precision-dashboard-auth");
    if (unlocked === "true") {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    const loadWatchlist = async () => {
      setLoadingWatchlist(true);

      try {
        const { data, error } = await supabase
          .from("watchlist")
          .select("*")
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Load watchlist error:", error);

          if (initialWatchlist.length > 0) {
            setList(initialWatchlist);
            setSelectedSymbol(initialWatchlist[0].symbol);
          }

          return;
        }

        if (data && data.length > 0) {
          const loaded: Item[] = data.map((row: any) => ({
            symbol: row.symbol,
            bias: row.bias ?? "Watch",
            price: num(row.price),
            support: num(row.support),
            resistance: num(row.resistance),
            rsi: num(row.rsi, 50),
            volumeRatio: num(row.volumeRatio, 1),
            technicalScore: num(row.technicalScore, 70),
            whaleScore: num(row.whaleScore, 60),
            macroScore: num(row.macroScore, 60),
            politicalScore: num(row.politicalScore, 60),
            notes: [],
          }));

          setList(loaded);
          setSelectedSymbol((prev) => prev || loaded[0]?.symbol || "");
        } else {
          setList(initialWatchlist);
          setSelectedSymbol(initialWatchlist[0]?.symbol ?? "");
        }
      } finally {
        setLoadingWatchlist(false);
      }
    };

    void loadWatchlist();
  }, []);

  const handleLogin = () => {
    if (!sitePassword) {
      setLoginError("Missing site password configuration.");
      return;
    }

    if (passwordInput === sitePassword) {
      setAuthenticated(true);
      localStorage.setItem("precision-dashboard-auth", "true");
      setLoginError("");
      setPasswordInput("");
      return;
    }

    setLoginError("Incorrect password.");
  };

  const handleLogout = () => {
    localStorage.removeItem("precision-dashboard-auth");
    setAuthenticated(false);
    setPasswordInput("");
  };

  const selected = useMemo(() => {
    if (list.length === 0) return null;
    return list.find((x) => x.symbol === selectedSymbol) ?? list[0];
  }, [list, selectedSymbol]);

  const getScore = (x: Item) =>
    Math.round(
      clamp(x.technicalScore) * 0.45 +
        clamp(x.whaleScore) * 0.2 +
        clamp(x.macroScore) * 0.2 +
        clamp(x.politicalScore) * 0.15
    );

  const getSignal = (score: number) => {
    if (score >= 85) return "Strong Buy";
    if (score >= 75) return "Buy";
    if (score >= 65) return "Watch";
    if (score >= 55) return "Caution";
    return "Avoid";
  };

  const getColor = (signal: string) => {
    if (signal === "Strong Buy" || signal === "Buy") return "green";
    if (signal === "Watch") return "#d97706";
    if (signal === "Caution") return "#b45309";
    return "red";
  };

  const addSymbol = async () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;

    if (list.some((x) => x.symbol === symbol)) {
      setSelectedSymbol(symbol);
      setQuoteMessage(`${symbol} already exists.`);
      setNewSymbol("");
      return;
    }

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
      const { error } = await supabase.from("watchlist").insert([
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
        },
      ]);

      if (error) {
        setQuoteMessage(`Supabase error: ${error.message}`);
        return;
      }

      setList((prev) => [...prev, row]);
      setSelectedSymbol(symbol);
      setNewSymbol("");
      setQuoteMessage(`${symbol} added successfully.`);
    } catch {
      setQuoteMessage("Unexpected add error.");
    } finally {
      setAdding(false);
    }
  };

  const deleteSymbol = async (symbol: string) => {
    setDeletingSymbol(symbol);
    setQuoteMessage("");

    try {
      const { error } = await supabase
        .from("watchlist")
        .delete()
        .eq("symbol", symbol);

      if (error) {
        setQuoteMessage(`Delete failed: ${error.message}`);
        return;
      }

      setList((prev) => {
        const updated = prev.filter((x) => x.symbol !== symbol);

        if (selectedSymbol === symbol) {
          setSelectedSymbol(updated[0]?.symbol ?? "");
          setHistory([]);
        }

        return updated;
      });

      setQuoteMessage(`${symbol} deleted successfully.`);
    } catch {
      setQuoteMessage(`Unexpected delete error for ${symbol}.`);
    } finally {
      setDeletingSymbol(null);
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
        throw new Error(data.error || "Quote request failed.");
      }

      setList((prev) =>
        prev.map((x) =>
          x.symbol === symbol
            ? {
                ...x,
                price: num(data.price),
                support: num(data.low, x.support),
                resistance: num(data.high, x.resistance),
              }
            : x
        )
      );

      setHistory((prev) => [
        ...prev.slice(-29),
        {
          time: new Date().toLocaleTimeString(),
          price: num(data.price),
        },
      ]);

      setQuoteMessage(`Live quote updated for ${symbol}.`);
    } catch {
      setQuoteMessage(`Quote failed for ${symbol}.`);
    } finally {
      setLoadingQuote(false);
    }
  };

  const refreshSentiment = async (sym?: string) => {
    const symbol = sym ?? selectedSymbol;
    if (!symbol) return;

    setLoadingSentiment(true);

    try {
      const res = await fetch(
        `/api/finnhub/sentiment?symbol=${encodeURIComponent(symbol)}`
      );

      const data: SentimentResponse = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Sentiment request failed.");
      }

      setList((prev) =>
        prev.map((x) => {
          if (x.symbol !== symbol) return x;

          const sentimentScore = num(data.sentimentScore);
          const politicalScore =
            sentimentScore >= 65
              ? Math.min(100, x.politicalScore + 5)
              : sentimentScore <= 40
              ? Math.max(0, x.politicalScore - 5)
              : x.politicalScore;

          return { ...x, politicalScore };
        })
      );

      const label = data.sentimentLabel ? ` (${data.sentimentLabel})` : "";
      setSentimentMessage(
        `Sentiment updated for ${symbol}${label}. Score: ${num(
          data.sentimentScore
        )}`
      );
    } catch {
      setSentimentMessage(`Sentiment failed for ${symbol}.`);
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (!authenticated || !selectedSymbol) return;

    setHistory([]);
    void refreshQuote(selectedSymbol);

    const timer = setInterval(() => {
      void refreshQuote(selectedSymbol);
    }, 10000);

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

    if (history.length < 2) {
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px Arial";
      ctx.fillText("Waiting for live data...", 20, 40);
      return;
    }

    const prices = history.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    const pad = 20;

    ctx.beginPath();
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 2;

    history.forEach((point, i) => {
      const x = pad + (i / (history.length - 1)) * (width - pad * 2);
      const y =
        height - pad - ((point.price - min) / range) * (height - pad * 2);

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();

    ctx.fillStyle = "#111827";
    ctx.font = "12px Arial";
    ctx.fillText(`Low: ${min.toFixed(2)}`, 10, height - 6);
    ctx.fillText(`High: ${max.toFixed(2)}`, width - 90, 14);
  }, [history]);

  if (!authenticated) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f8fafc",
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 420,
            background: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            padding: 24,
            boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          }}
        >
          <h1 style={{ marginTop: 0, marginBottom: 8 }}>
            Precision Swing Dashboard
          </h1>
          <p style={{ color: "#6b7280", marginBottom: 20 }}>
            Enter password to access the web app.
          </p>

          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLogin();
            }}
            placeholder="Password"
            style={{
              width: "100%",
              padding: 10,
              borderRadius: 8,
              border: "1px solid #d1d5db",
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />

          <button
            onClick={handleLogin}
            style={{
              width: "100%",
              padding: 10,
              border: "none",
              borderRadius: 8,
              background: "#111827",
              color: "#ffffff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Login
          </button>

          {loginError ? (
            <p style={{ color: "red", marginTop: 12 }}>{loginError}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (loadingWatchlist) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        Loading watchlist...
      </div>
    );
  }

  if (!selected) {
    return (
      <div style={{ padding: 24, fontFamily: "Arial, sans-serif" }}>
        <h1>📊 Precision Swing Dashboard</h1>
        <p>No symbols found. Add a ticker to begin.</p>

        <div style={{ marginTop: 16 }}>
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Enter symbol (TSLA)"
            style={{ padding: 6 }}
          />
          <button
            onClick={addSymbol}
            disabled={adding}
            style={{ marginLeft: 8, padding: "6px 12px" }}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>

        <p style={{ marginTop: 12 }}>{quoteMessage}</p>
      </div>
    );
  }

  const score = getScore(selected);
  const signal = getSignal(score);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1300,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>📊 Precision Swing Dashboard</h1>
          <p style={{ color: "#666", marginTop: 0 }}>
            Finnhub quotes + sentiment layered over technical, whale, macro, and
            political scoring
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: "1px solid #d1d5db",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Logout
        </button>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div>
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="Enter symbol (TSLA)"
            style={{ padding: 6 }}
          />

          <button
            onClick={addSymbol}
            disabled={adding}
            style={{ marginLeft: 8, padding: "6px 12px" }}
          >
            {adding ? "Adding..." : "Add"}
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: 20,
          display: "grid",
          gridTemplateColumns: "minmax(320px, 1fr) minmax(320px, 1fr)",
          gap: 20,
        }}
      >
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h3>🎯 Selected Ticker</h3>

          <div style={{ marginBottom: 16 }}>
            <canvas
              ref={chartRef}
              width={520}
              height={180}
              style={{
                width: "100%",
                height: 180,
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                background: "#ffffff",
              }}
            />
          </div>

          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            style={{ padding: 6, marginBottom: 12 }}
          >
            {list.map((x) => (
              <option key={x.symbol} value={x.symbol}>
                {x.symbol}
              </option>
            ))}
          </select>

          <div style={{ marginBottom: 12 }}>
            <button
              onClick={() => void refreshQuote()}
              disabled={loadingQuote}
              style={{ padding: "6px 10px" }}
            >
              {loadingQuote ? "Loading..." : "Refresh Quote"}
            </button>

            <button
              onClick={() => void refreshSentiment()}
              disabled={loadingSentiment}
              style={{ padding: "6px 10px", marginLeft: 8 }}
            >
              {loadingSentiment ? "Loading..." : "Refresh Sentiment"}
            </button>
          </div>

          <p>{quoteMessage}</p>
          <p>{sentimentMessage}</p>

          <p><b>Bias:</b> {selected.bias}</p>
          <p><b>Price:</b> ${selected.price.toFixed(2)}</p>
          <p><b>Support:</b> ${selected.support.toFixed(2)}</p>
          <p><b>Resistance:</b> ${selected.resistance.toFixed(2)}</p>
          <p><b>RSI:</b> {selected.rsi}</p>
          <p><b>Technical:</b> {selected.technicalScore}</p>
          <p><b>Whale:</b> {selected.whaleScore}</p>
          <p><b>Macro:</b> {selected.macroScore}</p>
          <p><b>Political:</b> {selected.politicalScore}</p>
          <p><b>Final Score:</b> {score}</p>

          <p
            style={{
              fontWeight: 700,
              color: getColor(signal),
              fontSize: 18,
            }}
          >
            Signal: {signal}
          </p>
        </div>

        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <h3>📋 Watchlist</h3>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
            }}
          >
            <thead>
              <tr style={{ background: "#f3f4f6" }}>
                <th style={{ padding: 8, textAlign: "left" }}>Ticker</th>
                <th style={{ padding: 8, textAlign: "right" }}>Price</th>
                <th style={{ padding: 8, textAlign: "center" }}>Score</th>
                <th style={{ padding: 8, textAlign: "center" }}>Signal</th>
                <th style={{ padding: 8, textAlign: "center" }}>Action</th>
              </tr>
            </thead>

            <tbody>
              {list.map((x) => {
                const s = getScore(x);
                const sig = getSignal(s);

                return (
                  <tr key={x.symbol} style={{ borderBottom: "1px solid #eee" }}>
                    <td
                      style={{ padding: 8, fontWeight: 600, cursor: "pointer" }}
                      onClick={() => setSelectedSymbol(x.symbol)}
                    >
                      {x.symbol}
                    </td>

                    <td style={{ padding: 8, textAlign: "right" }}>
                      ${x.price.toFixed(2)}
                    </td>

                    <td
                      style={{
                        padding: 8,
                        textAlign: "center",
                        fontWeight: 700,
                        color:
                          s >= 80 ? "green" : s >= 65 ? "#d97706" : "red",
                      }}
                    >
                      {s}
                    </td>

                    <td
                      style={{
                        padding: 8,
                        textAlign: "center",
                        fontWeight: 700,
                        color: getColor(sig),
                      }}
                    >
                      {sig}
                    </td>

                    <td style={{ padding: 8, textAlign: "center" }}>
                      <button
                        onClick={() => void deleteSymbol(x.symbol)}
                        disabled={deletingSymbol === x.symbol}
                        style={{
                          padding: "4px 8px",
                          borderRadius: 6,
                          border: "1px solid #d1d5db",
                          background: "#fff",
                          cursor: "pointer",
                        }}
                      >
                        {deletingSymbol === x.symbol ? "Deleting..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
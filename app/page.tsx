"use client";

import { useEffect, useMemo, useState } from "react";
import {
  watchlist as initialWatchlist,
  type WatchlistItem,
} from "./lib/watchlist";

type EditableWatchlistItem = WatchlistItem & {
  notes?: string[];
};

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
};

const toSafeNumber = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const safeText = (value: unknown, fallback = "—"): string => {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text ? text : fallback;
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ccc",
  padding: 8,
};

const tdStyle: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: 8,
};

const scoreCellStyle = (score: number): React.CSSProperties => {
  const safeScore = toSafeNumber(score);

  return {
    borderBottom: "1px solid #eee",
    padding: 8,
    fontWeight: "bold",
    color: safeScore >= 85 ? "green" : safeScore >= 70 ? "orange" : "red",
  };
};

export default function Dashboard() {
  const [capital, setCapital] = useState(8000);
  const [list, setList] = useState<EditableWatchlistItem[]>(initialWatchlist);
  const [selectedSymbol, setSelectedSymbol] = useState(
    initialWatchlist[0]?.symbol ?? ""
  );
  const [newSymbol, setNewSymbol] = useState("");
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [quoteMessage, setQuoteMessage] = useState("");
  const [sentimentMessage, setSentimentMessage] = useState("");

  const tradeSize = Math.min(2000, Math.max(1200, capital * 0.2));

  const selected = useMemo(() => {
    return list.find((item) => item.symbol === selectedSymbol) ?? list[0] ?? null;
  }, [selectedSymbol, list]);

  const getGrade = (score: number) => {
    const safeScore = toSafeNumber(score);
    if (safeScore >= 85) return "A";
    if (safeScore >= 70) return "B";
    return "C";
  };

  const getFinalScore = (item: EditableWatchlistItem) => {
    const technical = toSafeNumber(item.technicalScore);
    const whale = toSafeNumber(item.whaleScore);
    const macro = toSafeNumber(item.macroScore);
    const political = toSafeNumber(item.politicalScore);

    return Math.round(
      technical * 0.45 +
        whale * 0.2 +
        macro * 0.2 +
        political * 0.15
    );
  };

  const getFinalSignal = (score: number) => {
    const safeScore = toSafeNumber(score);
    if (safeScore >= 85) return "Strong Buy";
    if (safeScore >= 75) return "Buy";
    if (safeScore >= 65) return "Watch";
    if (safeScore >= 55) return "Caution";
    return "Avoid";
  };

  const getSignalColor = (signal: string) => {
    if (signal === "Strong Buy" || signal === "Buy") return "green";
    if (signal === "Watch") return "orange";
    if (signal === "Caution") return "#cc8400";
    return "red";
  };

  const getBiasColor = (bias: EditableWatchlistItem["bias"]) => {
    if (bias === "Bullish") return "green";
    if (bias === "Bearish") return "red";
    return "orange";
  };

  const addSymbol = () => {
    const symbol = newSymbol.trim().toUpperCase();
    if (!symbol) return;

    if (list.some((item) => item.symbol === symbol)) {
      setSelectedSymbol(symbol);
      setNewSymbol("");
      return;
    }

    const newItem: EditableWatchlistItem = {
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
      notes: ["New symbol added manually", "Update live data and scores"],
    };

    setList((prev) => [...prev, newItem]);
    setSelectedSymbol(symbol);
    setNewSymbol("");
  };

  const updateSelectedField = (
    field: keyof EditableWatchlistItem,
    value: string | number | string[]
  ) => {
    if (!selected) return;

    setList((prev) =>
      prev.map((item) =>
        item.symbol === selected.symbol
          ? {
              ...item,
              [field]: value,
            }
          : item
      )
    );
  };

  const getInputNumber = (value: string) => {
    if (value.trim() === "") return 0;
    return toSafeNumber(value, 0);
  };

  const refreshQuote = async () => {
    if (!selected) return;

    setLoadingQuote(true);
    setQuoteMessage("");

    try {
      const response = await fetch(
        `/api/finnhub/quote?symbol=${encodeURIComponent(selected.symbol)}`
      );

      const data: QuoteResponse & { error?: string } = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Quote fetch failed");
      }

      setList((prev) =>
        prev.map((item) =>
          item.symbol === selected.symbol
            ? {
                ...item,
                price: toSafeNumber(data.price, item.price),
                support:
                  toSafeNumber(data.low) > 0 ? toSafeNumber(data.low) : item.support,
                resistance:
                  toSafeNumber(data.high) > 0
                    ? toSafeNumber(data.high)
                    : item.resistance,
                notes: [
                  ...(Array.isArray(item.notes) ? item.notes : []),
                  `Live quote refreshed: ${new Date().toLocaleTimeString()}`,
                ].slice(-6),
              }
            : item
        )
      );

      setQuoteMessage("Live quote updated.");
    } catch (err) {
      console.error(err);
      setQuoteMessage("Could not load live quote.");
    } finally {
      setLoadingQuote(false);
    }
  };

  const refreshSentiment = async () => {
    if (!selected) return;

    setLoadingSentiment(true);
    setSentimentMessage("");

    try {
      const response = await fetch(
        `/api/finnhub/sentiment?symbol=${encodeURIComponent(selected.symbol)}`
      );

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || "Sentiment fetch failed");
      }

      const sentimentScore = toSafeNumber(data.sentimentScore, 0);
      const currentPolitical = toSafeNumber(selected.politicalScore, 60);

      const adjustedPolitical =
        sentimentScore >= 15
          ? Math.min(100, currentPolitical + 5)
          : sentimentScore <= 3
          ? Math.max(0, currentPolitical - 5)
          : currentPolitical;

      setList((prev) =>
        prev.map((item) =>
          item.symbol === selected.symbol
            ? {
                ...item,
                politicalScore: adjustedPolitical,
                notes: [
                  `Sentiment refresh: ${toSafeNumber(data.newsCount, 0)} news items`,
                  ...(Array.isArray(item.notes) ? item.notes : []),
                ].slice(0, 6),
              }
            : item
        )
      );

      setSentimentMessage("Sentiment updated.");
    } catch (err) {
      console.error(err);
      setSentimentMessage("Could not load sentiment.");
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (!selected) return;

    void refreshQuote();

    const interval = setInterval(() => {
      void refreshQuote();
    }, 10000);

    return () => clearInterval(interval);
  }, [selectedSymbol]);

  if (!selected) {
    return <div style={{ padding: 30 }}>No symbols loaded.</div>;
  }

  const finalScore = getFinalScore(selected);
  const finalSignal = getFinalSignal(finalScore);
  const safeNotes = Array.isArray(selected.notes) ? selected.notes : [];

  return (
    <div
      style={{
        padding: 30,
        fontFamily: "Arial, sans-serif",
        maxWidth: 1200,
        margin: "0 auto",
      }}
    >
      <h1>📊 Precision Swing Dashboard</h1>
      <p style={{ color: "#555", marginTop: 6 }}>
        Finnhub quotes + sentiment, layered over technical, whale, macro, and political scoring
      </p>

      <div style={{ marginTop: 20 }}>
        <label>Capital: </label>
        <input
          type="number"
          value={capital}
          onChange={(e) => setCapital(getInputNumber(e.target.value))}
          style={{ marginLeft: 10, padding: 6 }}
        />
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Add Ticker</h3>
        <input
          value={newSymbol}
          onChange={(e) => setNewSymbol(e.target.value)}
          placeholder="Enter symbol (e.g. TSLA)"
          style={{ padding: 6, marginRight: 10 }}
        />
        <button onClick={addSymbol} style={{ padding: "6px 12px" }}>
          Add
        </button>
      </div>

      <div
        style={{
          marginTop: 30,
          padding: 16,
          border: "1px solid #ccc",
          borderRadius: 8,
        }}
      >
        <h2>💰 Trade Plan</h2>
        <p>Total Allocation: ${Math.round(tradeSize)}</p>
        <p>Shares: ${Math.round(tradeSize * 0.6)}</p>
        <p>Options: ${Math.round(tradeSize * 0.4)}</p>
      </div>

      <div
        style={{
          marginTop: 30,
          display: "grid",
          gridTemplateColumns: "1.3fr 1fr",
          gap: 20,
        }}
      >
        <div
          style={{
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        >
          <h2>🎯 Selected Ticker</h2>

          <div style={{ marginBottom: 12 }}>
            <label>Choose ticker: </label>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              style={{ marginLeft: 10, padding: 6 }}
            >
              {list.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button onClick={refreshQuote} disabled={loadingQuote} style={{ padding: "6px 12px" }}>
              {loadingQuote ? "Refreshing..." : "Refresh Quote"}
            </button>
            <button
              onClick={refreshSentiment}
              disabled={loadingSentiment}
              style={{ padding: "6px 12px" }}
            >
              {loadingSentiment ? "Refreshing..." : "Refresh Sentiment"}
            </button>
          </div>

          {quoteMessage ? <p style={{ color: "#555" }}>{quoteMessage}</p> : null}
          {sentimentMessage ? <p style={{ color: "#555" }}>{sentimentMessage}</p> : null}

          <p>
            Bias:{" "}
            <span style={{ color: getBiasColor(selected.bias), fontWeight: "bold" }}>
              {safeText(selected.bias)}
            </span>
          </p>
          <p>Price: ${toSafeNumber(selected.price)}</p>
          <p>Support: ${toSafeNumber(selected.support)}</p>
          <p>Resistance: ${toSafeNumber(selected.resistance)}</p>
          <p>RSI: {toSafeNumber(selected.rsi)}</p>
          <p>Volume Ratio: {toSafeNumber(selected.volumeRatio)}x</p>
          <p>Technical Score: {toSafeNumber(selected.technicalScore)}</p>
          <p>Whale Score: {toSafeNumber(selected.whaleScore)}</p>
          <p>Macro Score: {toSafeNumber(selected.macroScore)}</p>
          <p>Political Score: {toSafeNumber(selected.politicalScore)}</p>
          <p>Final Score: {finalScore}</p>
          <p>Setup Grade: {getGrade(finalScore)}</p>
          <p>
            Signal:{" "}
            <span style={{ color: getSignalColor(finalSignal), fontWeight: "bold" }}>
              {finalSignal}
            </span>
          </p>

          <div style={{ marginTop: 14 }}>
            <strong>Notes:</strong>
            {safeNotes.length > 0 ? (
              <ul style={{ marginTop: 8 }}>
                {safeNotes.map((note, index) => (
                  <li key={`${selected.symbol}-note-${index}`}>{safeText(note)}</li>
                ))}
              </ul>
            ) : (
              <p style={{ marginTop: 8, color: "#666" }}>No notes yet.</p>
            )}
          </div>
        </div>

        <div
          style={{
            padding: 16,
            border: "1px solid #ccc",
            borderRadius: 8,
          }}
        >
          <h2>🛠️ Manual Driver Inputs</h2>
          <p style={{ color: "#555", marginTop: 0 }}>
            Live quote and sentiment are connected. Other drivers can still be adjusted manually.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            <label>
              Price
              <input
                type="number"
                value={toSafeNumber(selected.price)}
                onChange={(e) => updateSelectedField("price", getInputNumber(e.target.value))}
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Support
              <input
                type="number"
                value={toSafeNumber(selected.support)}
                onChange={(e) => updateSelectedField("support", getInputNumber(e.target.value))}
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Resistance
              <input
                type="number"
                value={toSafeNumber(selected.resistance)}
                onChange={(e) =>
                  updateSelectedField("resistance", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              RSI
              <input
                type="number"
                value={toSafeNumber(selected.rsi)}
                onChange={(e) => updateSelectedField("rsi", getInputNumber(e.target.value))}
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Volume Ratio
              <input
                type="number"
                step="0.1"
                value={toSafeNumber(selected.volumeRatio)}
                onChange={(e) =>
                  updateSelectedField("volumeRatio", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Technical Score
              <input
                type="number"
                value={toSafeNumber(selected.technicalScore)}
                onChange={(e) =>
                  updateSelectedField("technicalScore", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Whale Score
              <input
                type="number"
                value={toSafeNumber(selected.whaleScore)}
                onChange={(e) =>
                  updateSelectedField("whaleScore", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Macro Score
              <input
                type="number"
                value={toSafeNumber(selected.macroScore)}
                onChange={(e) =>
                  updateSelectedField("macroScore", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>

            <label>
              Political Score
              <input
                type="number"
                value={toSafeNumber(selected.politicalScore)}
                onChange={(e) =>
                  updateSelectedField("politicalScore", getInputNumber(e.target.value))
                }
                style={{ display: "block", marginTop: 4, padding: 6, width: "100%" }}
              />
            </label>
          </div>
        </div>
      </div>

      <div
        style={{
          marginTop: 30,
          padding: 16,
          border: "1px solid #ccc",
          borderRadius: 8,
        }}
      >
        <h2>📋 Watchlist</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr>
              <th style={thStyle}>Ticker</th>
              <th style={thStyle}>Bias</th>
              <th style={thStyle}>Price</th>
              <th style={thStyle}>Tech</th>
              <th style={thStyle}>Whale</th>
              <th style={thStyle}>Macro</th>
              <th style={thStyle}>Political</th>
              <th style={thStyle}>Final</th>
              <th style={thStyle}>Grade</th>
              <th style={thStyle}>Signal</th>
            </tr>
          </thead>
          <tbody>
            {list.map((item) => {
              const safePrice = toSafeNumber(item.price);
              const safeTechnical = toSafeNumber(item.technicalScore);
              const safeWhale = toSafeNumber(item.whaleScore);
              const safeMacro = toSafeNumber(item.macroScore);
              const safePolitical = toSafeNumber(item.politicalScore);
              const itemFinalScore = getFinalScore(item);
              const itemSignal = getFinalSignal(itemFinalScore);

              return (
                <tr key={item.symbol}>
                  <td style={tdStyle}>{safeText(item.symbol)}</td>
                  <td style={{ ...tdStyle, color: getBiasColor(item.bias), fontWeight: "bold" }}>
                    {safeText(item.bias)}
                  </td>
                  <td style={tdStyle}>${safePrice}</td>
                  <td style={scoreCellStyle(safeTechnical)}>{safeTechnical}</td>
                  <td style={scoreCellStyle(safeWhale)}>{safeWhale}</td>
                  <td style={scoreCellStyle(safeMacro)}>{safeMacro}</td>
                  <td style={scoreCellStyle(safePolitical)}>{safePolitical}</td>
                  <td style={scoreCellStyle(itemFinalScore)}>{itemFinalScore}</td>
                  <td style={tdStyle}>{getGrade(itemFinalScore)}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color: getSignalColor(itemSignal),
                      fontWeight: "bold",
                    }}
                  >
                    {itemSignal}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
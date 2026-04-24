"use client";

import { useMemo, useState } from "react";
import type { IntelligenceApiResponse, IntelligenceScoreResult } from "@/types/intelligence";

interface IntelligenceDashboardShellProps {
  initialData: IntelligenceApiResponse;
}

function labelColor(label: IntelligenceScoreResult["label"]): string {
  if (label === "Strong Buy") return "#16a34a";
  if (label === "Buy") return "#22c55e";
  if (label === "Watch") return "#f59e0b";
  if (label === "Caution") return "#fb923c";
  return "#ef4444";
}

export default function IntelligenceDashboardShell({
  initialData,
}: IntelligenceDashboardShellProps) {
  const [data, setData] = useState<IntelligenceApiResponse>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const sortedItems = useMemo(
    () => [...data.items].sort((a, b) => b.overallScore - a.overallScore),
    [data.items]
  );

  const refresh = async () => {
    setRefreshing(true);
    setError("");

    try {
      const response = await fetch("/api/intelligence/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ force: true }),
      });

      const payload = (await response.json()) as IntelligenceApiResponse & { error?: string };

      if (!response.ok || payload.error) {
        setError(payload.error ?? "Refresh failed");
        return;
      }

      setData(payload);
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <main style={{ padding: 24, color: "#e2e8f0", background: "#020617", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>V7.1 Intelligence Layer</h1>
            <p style={{ marginTop: 8, color: "#94a3b8" }}>
              Source: {data.source} • Generated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
          <button
            onClick={refresh}
            disabled={refreshing}
            style={{
              borderRadius: 10,
              border: "1px solid #334155",
              background: refreshing ? "#334155" : "#0f766e",
              color: "white",
              fontWeight: 700,
              padding: "10px 14px",
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh Intelligence"}
          </button>
        </header>

        {error ? <p style={{ color: "#f87171" }}>{error}</p> : null}

        <section
          style={{
            marginTop: 18,
            display: "grid",
            gap: 14,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {sortedItems.map((item) => (
            <article
              key={item.symbol}
              style={{
                border: "1px solid #1e293b",
                borderRadius: 14,
                padding: 14,
                background: "rgba(15,23,42,0.8)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong>{item.symbol}</strong>
                <span style={{ color: labelColor(item.label), fontWeight: 700 }}>{item.label}</span>
              </div>
              <p style={{ marginTop: 8, marginBottom: 8 }}>
                Score {item.overallScore.toFixed(2)} / 10 • {item.bestStrategy}
              </p>
              <p style={{ margin: "6px 0", color: "#94a3b8" }}>
                Swing {item.horizonScores.swing.toFixed(1)} • 3M {item.horizonScores.threeMonth.toFixed(1)} • 6M {item.horizonScores.sixMonth.toFixed(1)} • 1Y {item.horizonScores.oneYear.toFixed(1)}
              </p>
              <p style={{ margin: "6px 0", color: "#94a3b8" }}>
                Confidence {item.confidencePct}% • Risk {item.riskLevel}
              </p>
            </article>
          ))}
        </section>
      </div>
    </main>
  );
}

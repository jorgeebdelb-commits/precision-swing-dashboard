"use client";

import { useMemo, useState } from "react";
import type {
  AnalysisResult,
  IntelligenceApiResponse,
  ModulePerformance,
  SignalPerformance,
} from "@/lib/intelligence/types";

interface IntelligenceDashboardShellProps {
  initialData: IntelligenceApiResponse;
}

function recommendationColor(recommendation: AnalysisResult["recommendation"]): string {
  if (recommendation === "Buy") return "#22c55e";
  if (recommendation === "Watch") return "#f59e0b";
  return "#ef4444";
}

function moduleLabel(moduleName: ModulePerformance["moduleName"]): string {
  if (moduleName === "shortTerm") return "Short-Term";
  if (moduleName === "fundamental3m") return "3-Month";
  if (moduleName === "fundamental6m") return "6-Month";
  return "1-Year+";
}

function emptySignalState(): SignalPerformance[] {
  return [];
}

export default function IntelligenceDashboardShell({
  initialData,
}: IntelligenceDashboardShellProps) {
  const [data] = useState<IntelligenceApiResponse>(initialData);

  const summaries = useMemo(
    () => [...data.items].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [data.items]
  );

  return (
    <main style={{ padding: 24, color: "#e2e8f0", background: "#020617", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "center" }}>
          <div>
            <h1 style={{ margin: 0 }}>V7.2 Adaptive Horizon Intelligence Engine</h1>
            <p style={{ marginTop: 8, color: "#94a3b8" }}>
              Source: {data.source} • Generated: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </div>
        </header>

        {summaries.map((summary) => (
          <section
            key={summary.symbol}
            style={{
              marginTop: 18,
              border: "1px solid #1e293b",
              borderRadius: 14,
              padding: 14,
              background: "rgba(15,23,42,0.8)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0 }}>{summary.symbol}</h2>
              <span style={{ color: "#67e8f9", fontWeight: 700 }}>
                Best Horizon: {summary.bestHorizon}
              </span>
            </div>

            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: "#94a3b8", textAlign: "left", fontSize: 13 }}>
                    <th style={{ padding: "8px 6px" }}>Horizon</th>
                    <th style={{ padding: "8px 6px" }}>Recommendation</th>
                    <th style={{ padding: "8px 6px" }}>Score</th>
                    <th style={{ padding: "8px 6px" }}>Confidence</th>
                    <th style={{ padding: "8px 6px" }}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.analyses.map((analysis) => (
                    <tr key={`${summary.symbol}-${analysis.horizon}`} style={{ borderTop: "1px solid #1e293b" }}>
                      <td style={{ padding: "8px 6px" }}>{analysis.horizon}</td>
                      <td style={{ padding: "8px 6px", color: recommendationColor(analysis.recommendation) }}>
                        {analysis.recommendation}
                      </td>
                      <td style={{ padding: "8px 6px" }}>{analysis.score.toFixed(2)}</td>
                      <td style={{ padding: "8px 6px" }}>{analysis.confidence.toFixed(1)}%</td>
                      <td style={{ padding: "8px 6px", color: "#cbd5e1" }}>{analysis.reasoning[0] ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}

        <section style={{ marginTop: 22, display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
          <article style={{ border: "1px solid #1e293b", borderRadius: 14, padding: 14, background: "rgba(15,23,42,0.8)" }}>
            <h3 style={{ marginTop: 0 }}>Performance Panel</h3>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ color: "#94a3b8", textAlign: "left" }}>
                  <th style={{ paddingBottom: 8 }}>Module</th>
                  <th style={{ paddingBottom: 8 }}>Win Rate</th>
                  <th style={{ paddingBottom: 8 }}>Avg Return</th>
                  <th style={{ paddingBottom: 8 }}>Last 30 Trades</th>
                </tr>
              </thead>
              <tbody>
                {data.performance.map((row) => (
                  <tr key={`${row.moduleName}-${row.horizon}`} style={{ borderTop: "1px solid #1e293b" }}>
                    <td style={{ padding: "8px 0" }}>{moduleLabel(row.moduleName)}</td>
                    <td style={{ padding: "8px 0" }}>{row.winRate.toFixed(1)}%</td>
                    <td style={{ padding: "8px 0" }}>{row.avgReturn.toFixed(2)}%</td>
                    <td style={{ padding: "8px 0" }}>{row.last30Trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article style={{ border: "1px solid #1e293b", borderRadius: 14, padding: 14, background: "rgba(15,23,42,0.8)" }}>
            <h3 style={{ marginTop: 0 }}>Best Performing Signals</h3>
            {(data.bestSignals.length ? data.bestSignals : emptySignalState()).map((signal) => (
              <div key={signal.signal} style={{ borderTop: "1px solid #1e293b", padding: "10px 0" }}>
                <strong>{signal.signal}</strong>
                <p style={{ margin: "4px 0", color: "#94a3b8" }}>
                  Win Rate {signal.winRate.toFixed(1)}% • Avg Return {signal.avgReturn.toFixed(2)}% • Samples {signal.sampleSize}
                </p>
              </div>
            ))}
            {!data.bestSignals.length ? (
              <p style={{ margin: 0, color: "#94a3b8" }}>
                No closed trade history yet. Signal rankings will populate automatically.
              </p>
            ) : null}
          </article>
        </section>
      </div>
    </main>
  );
}

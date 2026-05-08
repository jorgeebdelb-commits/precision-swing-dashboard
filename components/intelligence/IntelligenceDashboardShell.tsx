"use client";

import { useMemo, useState } from "react";
import type { BattlefieldApiResponse } from "@/lib/intelligence/types/battlefield";

interface IntelligenceDashboardShellProps { initialData: BattlefieldApiResponse; }

export default function IntelligenceDashboardShell({ initialData }: IntelligenceDashboardShellProps) {
  const [data] = useState(initialData ?? null);
  const items = useMemo(
    () => (Array.isArray(data?.items) ? [...data.items].sort((a, b) => (a?.symbol ?? "").localeCompare(b?.symbol ?? "")) : []),
    [data],
  );
  if (!data) {
    return <main style={{ padding: 24, color: "#e2e8f0", background: "#020617", minHeight: "100vh" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><h1>Battlefield Intelligence & Capital Deployment Console</h1><p style={{ color: "#fca5a5" }}>Battlefield data unavailable.</p></div></main>;
  }
  return <main style={{ padding: 24, color: "#e2e8f0", background: "#020617", minHeight: "100vh" }}><div style={{ maxWidth: 1200, margin: "0 auto" }}><h1>Battlefield Intelligence & Capital Deployment Console</h1><p style={{ color: "#94a3b8" }}>Generated: {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "Unknown"}</p>{items.map((it, idx) => <section key={it?.symbol ?? `row-${idx}`} style={{ marginTop: 16, border: "1px solid #1e293b", borderRadius: 12, padding: 14 }}><h2>{it?.symbol ?? "Unknown"} • Primary Opportunity: {it?.primaryOpportunity ?? "Unavailable"}</h2><p>{it?.battlefieldSummary ?? "Summary unavailable."}</p><h3>1) Swing Battlefield</h3><p>{it?.swing?.bias ?? "Unknown"} | Confidence {it?.swing?.confidence ?? "-"}% | Entry {it?.swing?.entryZone ?? "-"} | Stop {it?.swing?.stopZone ?? "-"} | Targets {it?.swing?.target1 ?? "-"}/{it?.swing?.target2 ?? "-"}</p><h3>2) Long-Term Battlefield</h3><p>{it?.longTerm?.bias ?? "Unknown"} | Confidence {it?.longTerm?.confidence ?? "-"}% | Accumulation {it?.longTerm?.accumulationZone ?? "-"} | 1Y {it?.longTerm?.expected1Y ?? "-"}</p><h3>3) Whale / Trap Intelligence</h3><p>Trap {it?.whale?.trapRisk ?? "-"}, Exhaustion {it?.whale?.exhaustionRisk ?? "-"}, Flow {it?.whale?.unusualFlow ?? "-"}. {it?.whale?.interpretation ?? "Unavailable."}</p><h3>4) Macro Terrain</h3><p>{it?.macro?.terrain ?? "Unknown"} | Volatility {it?.macro?.volatilityState ?? "-"} | Sector pressure {it?.macro?.sectorPressure ?? "-"}</p><h3>5) Political / World Risk</h3><p>Political {it?.politics?.politicalRisk ?? "-"}, Regulatory {it?.politics?.regulatoryRisk ?? "-"}, Geopolitical {it?.politics?.geopoliticalPressure ?? "-"}</p><h3>6) Sentiment Confirmation</h3><p>{it?.sentiment?.sentimentState ?? "Unknown"} ({it?.sentiment?.confirmationStrength ?? "-"}) — {it?.sentiment?.interpretation ?? "Unavailable"}</p><h3>7) Capital Deployment Plan</h3><p>{it?.deployment?.bestDeployment ?? "Unavailable"} via {it?.deployment?.preferredInstrument ?? "-"} | Sizing: {it?.deployment?.sizingAggressiveness ?? "-"}</p><h3>8) Entry / Exit Map</h3><p>Entry: {it?.deployment?.entryRange ?? "-"} • Stop: {it?.deployment?.stopRange ?? "-"} • Target: {it?.deployment?.targetRange ?? "-"} • Return: {it?.deployment?.estimatedReturn ?? "-"} • R/R: {it?.deployment?.riskReward ?? "-"}</p>{Array.isArray(it?.warnings) && it.warnings.length ? <ul>{it.warnings.map((w, warningIdx) => <li key={`${w}-${warningIdx}`}>{w}</li>)}</ul> : null}</section>)}</div></main>;
}

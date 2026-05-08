"use client";

import { useMemo, useState } from "react";
import type { BattlefieldApiResponse, BattlefieldOutput } from "@/lib/intelligence/types/battlefield";

interface IntelligenceDashboardShellProps { initialData: BattlefieldApiResponse; }

function toPercent(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toneClass(value: string | undefined) {
  if (!value) return "tone-neutral";
  const normalized = value.toLowerCase();
  if (normalized.includes("high") || normalized.includes("risk-off") || normalized.includes("avoid") || normalized.includes("put")) return "tone-danger";
  if (normalized.includes("moderate") || normalized.includes("watch") || normalized.includes("neutral") || normalized.includes("normal")) return "tone-warn";
  if (normalized.includes("low") || normalized.includes("buy") || normalized.includes("strong") || normalized.includes("tailwind") || normalized.includes("positive")) return "tone-good";
  return "tone-neutral";
}

function instrumentMix(deployment: BattlefieldOutput["deployment"]) {
  return [
    { label: "Shares", on: deployment.preferredInstrument === "Shares" },
    { label: "Calls", on: deployment.preferredInstrument === "Calls" },
    { label: "Puts", on: deployment.preferredInstrument === "Puts" },
    { label: "LEAPS", on: deployment.preferredInstrument === "LEAPS" },
  ];
}

export default function IntelligenceDashboardShell({ initialData }: IntelligenceDashboardShellProps) {
  const [data] = useState(initialData ?? null);
  const items = useMemo(
    () => (Array.isArray(data?.items) ? [...data.items].sort((a, b) => (a?.symbol ?? "").localeCompare(b?.symbol ?? "")) : []),
    [data],
  );

  if (!data) {
    return <main className="intel-shell"><div className="intel-wrap"><h1 className="intel-title">Battlefield Intelligence Console</h1><p className="intel-alert">Battlefield data unavailable.</p></div></main>;
  }

  return (
    <main className="intel-shell">
      <div className="intel-wrap">
        <header className="intel-topbar">
          <h1 className="intel-title">Battlefield Intelligence Console</h1>
          <p className="intel-meta">Generated {data.generatedAt ? new Date(data.generatedAt).toLocaleString() : "Unknown"}</p>
        </header>

        {items.map((it, idx) => {
          const swingPct = toPercent(it?.swing?.confidence);
          const longPct = toPercent(it?.longTerm?.confidence);
          const aggressivePct = it?.deployment?.sizingAggressiveness === "Full Size" ? 90 : it?.deployment?.sizingAggressiveness === "Half Size" ? 60 : it?.deployment?.sizingAggressiveness === "Starter Only" ? 35 : 10;
          return (
            <section key={it?.symbol ?? `row-${idx}`} className="tactical-cluster">
              <div className="symbol-banner">
                <h2>{it?.symbol ?? "Unknown"}</h2>
                <div className={`status-chip ${toneClass(it?.primaryOpportunity)}`}>{it?.primaryOpportunity ?? "Unavailable"}</div>
                <p>{it?.battlefieldSummary ?? "Summary unavailable."}</p>
              </div>

              <div className="grid-2">
                <article className="glass-card">
                  <h3>Swing Battlefield</h3>
                  <div className="metric-row"><span>Confidence</span><strong>{swingPct}%</strong></div>
                  <div className="meter"><i style={{ width: `${swingPct}%` }} /></div>
                  <div className="metric-row"><span>Momentum</span><span className={toneClass(it?.swing?.momentumQuality)}>{it?.swing?.momentumQuality}</span></div>
                  <div className="entry-map">
                    <div><label>Entry</label><b>{it?.swing?.entryZone ?? "-"}</b></div>
                    <div><label>Stop</label><b>{it?.swing?.stopZone ?? "-"}</b></div>
                    <div><label>T1</label><b>{it?.swing?.target1 ?? "-"}</b></div>
                    <div><label>T2</label><b>{it?.swing?.target2 ?? "-"}</b></div>
                  </div>
                </article>

                <article className="glass-card">
                  <h3>Long-Term Battlefield</h3>
                  <div className="metric-row"><span>Accumulation Quality</span><strong>{it?.longTerm?.longTermQuality ?? "-"}</strong></div>
                  <div className="metric-row"><span>Institutional Strength</span><span className={toneClass(it?.longTerm?.institutionalStrength)}>{it?.longTerm?.institutionalStrength ?? "-"}</span></div>
                  <div className="metric-row"><span>LEAP Suitability</span><span className={toneClass(it?.longTerm?.leapSuitability)}>{it?.longTerm?.leapSuitability ?? "-"}</span></div>
                  <div className="metric-row"><span>Horizon</span><strong>{it?.longTerm?.expected3M ?? "-"} / {it?.longTerm?.expected6M ?? "-"} / {it?.longTerm?.expected1Y ?? "-"}</strong></div>
                  <div className="meter long"><i style={{ width: `${longPct}%` }} /></div>
                </article>

                <article className="glass-card">
                  <h3>Whale Intelligence</h3>
                  <div className="radar-grid">
                    <div><small>Trap Radar</small><p className={toneClass(it?.whale?.trapRisk)}>{it?.whale?.trapRisk ?? "-"}</p></div>
                    <div><small>Exhaustion</small><p className={toneClass(it?.whale?.exhaustionRisk)}>{it?.whale?.exhaustionRisk ?? "-"}</p></div>
                    <div><small>Flow</small><p className={toneClass(it?.whale?.unusualFlow)}>{it?.whale?.unusualFlow ?? "-"}</p></div>
                    <div><small>Squeeze</small><p className={toneClass(it?.whale?.squeezePotential)}>{it?.whale?.squeezePotential ?? "-"}</p></div>
                  </div>
                </article>

                <article className="glass-card">
                  <h3>Macro Terrain</h3>
                  <div className={`terrain-banner ${toneClass(it?.macro?.terrain)}`}>{it?.macro?.terrain ?? "Unknown"}</div>
                  <div className="metric-row"><span>Volatility</span><strong>{it?.macro?.volatilityState ?? "-"}</strong></div>
                  <div className="metric-row"><span>Condition</span><strong>{it?.macro?.sectorPressure ?? "-"}</strong></div>
                  <div className="metric-row"><span>Sentiment</span><strong>{it?.sentiment?.sentimentState ?? "-"}</strong></div>
                </article>

                <article className="glass-card wide">
                  <h3>Deployment Panel</h3>
                  <div className="deployment-mix">
                    {instrumentMix(it.deployment).map((slot) => <span key={slot.label} className={slot.on ? "active" : "inactive"}>{slot.label}</span>)}
                  </div>
                  <div className="metric-row"><span>Aggressiveness</span><strong>{it?.deployment?.sizingAggressiveness ?? "-"}</strong></div>
                  <div className="meter"><i style={{ width: `${aggressivePct}%` }} /></div>
                  <div className="entry-map">
                    <div><label>Entry</label><b>{it?.deployment?.entryRange ?? "-"}</b></div>
                    <div><label>Stop</label><b>{it?.deployment?.stopRange ?? "-"}</b></div>
                    <div><label>Target</label><b>{it?.deployment?.targetRange ?? "-"}</b></div>
                    <div><label>Return Band</label><b>{it?.deployment?.estimatedReturn ?? "-"}</b></div>
                  </div>
                </article>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

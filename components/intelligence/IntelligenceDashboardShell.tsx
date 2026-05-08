"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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

function classificationClass(value: BattlefieldOutput["primaryOpportunity"]) {
  if (value === "Swing") return "class-swing";
  if (value === "Long-Term") return "class-long";
  if (value === "Both") return "class-both";
  return "class-neither";
}

export default function IntelligenceDashboardShell({ initialData }: IntelligenceDashboardShellProps) {
  const [watchlistSymbols, setWatchlistSymbols] = useState(
    () => (Array.isArray(initialData?.items) ? [...new Set(initialData.items.map((item) => item.symbol).filter(Boolean))].sort() : []),
  );
  const [itemsBySymbol, setItemsBySymbol] = useState<Record<string, BattlefieldOutput>>(
    () => Object.fromEntries((initialData?.items ?? []).map((item) => [item.symbol, item])),
  );
  const [selectedSymbol, setSelectedSymbol] = useState(() => watchlistSymbols[0] ?? "");
  const [search, setSearch] = useState("");
  const [addInput, setAddInput] = useState("");
  const [generatedAt, setGeneratedAt] = useState(initialData?.generatedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSymbol = useCallback(async (symbol: string, force = true) => {
    const target = symbol.trim().toUpperCase();
    if (!target) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/intelligence/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: [target], force }),
      });
      if (!response.ok) throw new Error("Failed to refresh battlefield data");
      const payload = (await response.json()) as BattlefieldApiResponse;
      const next = payload.items?.[0];
      if (!next) throw new Error(`No battlefield data returned for ${target}`);
      setItemsBySymbol((prev) => ({ ...prev, [target]: next }));
      setGeneratedAt(payload.generatedAt ?? new Date().toISOString());
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Unable to refresh selected ticker");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSymbol && watchlistSymbols.length > 0) {
      setSelectedSymbol(watchlistSymbols[0]);
    }
  }, [selectedSymbol, watchlistSymbols]);

  useEffect(() => {
    if (!selectedSymbol) return;
    const intervalId = window.setInterval(() => {
      void refreshSymbol(selectedSymbol, true);
    }, 10 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [refreshSymbol, selectedSymbol]);

  const filteredSymbols = useMemo(() => {
    const query = search.trim().toUpperCase();
    if (!query) return watchlistSymbols;
    return watchlistSymbols.filter((symbol) => symbol.includes(query));
  }, [search, watchlistSymbols]);

  const selectedItem = selectedSymbol ? itemsBySymbol[selectedSymbol] : null;

  const onSelectSymbol = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    void refreshSymbol(symbol, true);
  }, [refreshSymbol]);

  const onAddSymbol = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const symbol = addInput.trim().toUpperCase();
    if (!/^[A-Z]{1,6}$/.test(symbol)) {
      setError("Ticker must be 1-6 letters.");
      return;
    }

    if (!watchlistSymbols.includes(symbol)) {
      setWatchlistSymbols((prev) => [...prev, symbol].sort());
    }
    setSelectedSymbol(symbol);
    setAddInput("");
    await refreshSymbol(symbol, true);
  }, [addInput, refreshSymbol, watchlistSymbols]);

  const swingPct = toPercent(selectedItem?.swing?.confidence);
  const longPct = toPercent(selectedItem?.longTerm?.confidence);
  const aggressivePct = selectedItem?.deployment?.sizingAggressiveness === "Full Size" ? 90 : selectedItem?.deployment?.sizingAggressiveness === "Half Size" ? 60 : selectedItem?.deployment?.sizingAggressiveness === "Starter Only" ? 35 : 10;

  return (
    <main className="intel-shell">
      <div className="intel-wrap">
        <header className="intel-topbar">
          <h1 className="intel-title">Battlefield Intelligence Console</h1>
          <p className="intel-meta">Generated {generatedAt ? new Date(generatedAt).toLocaleString() : "Unknown"}</p>
        </header>

        {error ? <p className="intel-alert">{error}</p> : null}

        <div className="intel-layout">
          <aside className="watchlist-panel">
            <div className="watchlist-header">
              <h2>Watchlist</h2>
              <button type="button" onClick={() => selectedSymbol && void refreshSymbol(selectedSymbol, true)} disabled={!selectedSymbol || loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            </div>

            <form className="add-symbol" onSubmit={onAddSymbol}>
              <input
                value={addInput}
                onChange={(event) => setAddInput(event.target.value.toUpperCase())}
                placeholder="+ Add Symbol"
                aria-label="Add symbol"
                maxLength={6}
              />
              <button type="submit">Add</button>
            </form>

            <input
              className="watchlist-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search"
              aria-label="Search symbols"
            />

            <div className="watchlist-rows">
              {filteredSymbols.map((symbol) => {
                const item = itemsBySymbol[symbol];
                return (
                  <button key={symbol} type="button" className={`watch-row ${selectedSymbol === symbol ? "selected" : ""}`} onClick={() => onSelectSymbol(symbol)}>
                    <span>{symbol}</span>
                    <span>{typeof item?.price === "number" ? item.price.toFixed(2) : "-"}</span>
                    <span className={item ? classificationClass(item.primaryOpportunity) : "class-neither"}>{item?.primaryOpportunity ?? "Neither"}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="battlefield-main">
            {!selectedItem ? (
              <div className="symbol-banner"><h2>No ticker selected</h2><p>Select a symbol from the watchlist.</p></div>
            ) : (
              <section className="tactical-cluster">
                <div className="symbol-banner">
                  <h2>{selectedItem.symbol}</h2>
                  <div className={`status-chip ${toneClass(selectedItem.primaryOpportunity)}`}>{selectedItem.primaryOpportunity}</div>
                  <p>{selectedItem.battlefieldSummary}</p>
                </div>
                <div className="grid-2">
                  <article className="glass-card">
                    <h3>Swing Battlefield</h3>
                    <div className="metric-row"><span>Confidence</span><strong>{swingPct}%</strong></div>
                    <div className="meter"><i style={{ width: `${swingPct}%` }} /></div>
                    <div className="metric-row"><span>Momentum</span><span className={toneClass(selectedItem.swing?.momentumQuality)}>{selectedItem.swing?.momentumQuality}</span></div>
                    <div className="entry-map"><div><label>Entry</label><b>{selectedItem.swing?.entryZone ?? "-"}</b></div><div><label>Stop</label><b>{selectedItem.swing?.stopZone ?? "-"}</b></div><div><label>T1</label><b>{selectedItem.swing?.target1 ?? "-"}</b></div><div><label>T2</label><b>{selectedItem.swing?.target2 ?? "-"}</b></div></div>
                  </article>

                  <article className="glass-card">
                    <h3>Long-Term Battlefield</h3>
                    <div className="metric-row"><span>Accumulation Quality</span><strong>{selectedItem.longTerm?.longTermQuality ?? "-"}</strong></div>
                    <div className="metric-row"><span>Institutional Strength</span><span className={toneClass(selectedItem.longTerm?.institutionalStrength)}>{selectedItem.longTerm?.institutionalStrength ?? "-"}</span></div>
                    <div className="metric-row"><span>LEAP Suitability</span><span className={toneClass(selectedItem.longTerm?.leapSuitability)}>{selectedItem.longTerm?.leapSuitability ?? "-"}</span></div>
                    <div className="metric-row"><span>Horizon</span><strong>{selectedItem.longTerm?.expected3M ?? "-"} / {selectedItem.longTerm?.expected6M ?? "-"} / {selectedItem.longTerm?.expected1Y ?? "-"}</strong></div>
                    <div className="meter long"><i style={{ width: `${longPct}%` }} /></div>
                  </article>

                  <article className="glass-card"><h3>Whale Intelligence</h3><div className="radar-grid"><div><small>Trap Radar</small><p className={toneClass(selectedItem.whale?.trapRisk)}>{selectedItem.whale?.trapRisk ?? "-"}</p></div><div><small>Exhaustion</small><p className={toneClass(selectedItem.whale?.exhaustionRisk)}>{selectedItem.whale?.exhaustionRisk ?? "-"}</p></div><div><small>Flow</small><p className={toneClass(selectedItem.whale?.unusualFlow)}>{selectedItem.whale?.unusualFlow ?? "-"}</p></div><div><small>Squeeze</small><p className={toneClass(selectedItem.whale?.squeezePotential)}>{selectedItem.whale?.squeezePotential ?? "-"}</p></div></div></article>

                  <article className="glass-card"><h3>Macro Terrain</h3><div className={`terrain-banner ${toneClass(selectedItem.macro?.terrain)}`}>{selectedItem.macro?.terrain ?? "Unknown"}</div><div className="metric-row"><span>Volatility</span><strong>{selectedItem.macro?.volatilityState ?? "-"}</strong></div><div className="metric-row"><span>Condition</span><strong>{selectedItem.macro?.sectorPressure ?? "-"}</strong></div><div className="metric-row"><span>Sentiment</span><strong>{selectedItem.sentiment?.sentimentState ?? "-"}</strong></div></article>

                  <article className="glass-card wide"><h3>Deployment Panel</h3><div className="deployment-mix">{instrumentMix(selectedItem.deployment).map((slot) => <span key={slot.label} className={slot.on ? "active" : "inactive"}>{slot.label}</span>)}</div><div className="metric-row"><span>Aggressiveness</span><strong>{selectedItem.deployment?.sizingAggressiveness ?? "-"}</strong></div><div className="meter"><i style={{ width: `${aggressivePct}%` }} /></div><div className="entry-map"><div><label>Entry</label><b>{selectedItem.deployment?.entryRange ?? "-"}</b></div><div><label>Stop</label><b>{selectedItem.deployment?.stopRange ?? "-"}</b></div><div><label>Target</label><b>{selectedItem.deployment?.targetRange ?? "-"}</b></div><div><label>Return Band</label><b>{selectedItem.deployment?.estimatedReturn ?? "-"}</b></div></div></article>
                </div>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

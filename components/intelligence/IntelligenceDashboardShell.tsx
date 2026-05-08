"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { BattlefieldApiResponse, BattlefieldOutput } from "@/lib/intelligence/types/battlefield";
import InfoHelp from "@/components/ui/InfoHelp";

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

type CapitalFeedbackOutcome = "This worked" | "Stopped out" | "Target hit" | "Bad signal" | "Wrong instrument";

function parseDollarRange(value: string | undefined) {
  if (!value) return null;
  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
}

function nextThirdFriday(year: number, month: number) {
  const date = new Date(Date.UTC(year, month, 1));
  let fridayCount = 0;
  while (date.getUTCMonth() === month) {
    if (date.getUTCDay() === 5) fridayCount += 1;
    if (fridayCount === 3) return new Date(date);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return new Date(Date.UTC(year, month + 1, 1));
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
  const [capitalInput, setCapitalInput] = useState("5000");
  const [refreshStamp, setRefreshStamp] = useState(new Date().toISOString());

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
      setRefreshStamp(new Date().toISOString());
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
  const capitalAmount = Number(capitalInput.replace(/[^\d.]/g, ""));
  const safeCapital = Number.isFinite(capitalAmount) && capitalAmount > 0 ? capitalAmount : 0;
  const optionsFriendly = selectedItem?.longTerm?.leapSuitability !== "Low" && selectedItem?.macro?.volatilityState !== "Expansion";
  const trapHigh = selectedItem?.whale?.trapRisk === "High";
  const shareRatio = trapHigh ? 0.85 : optionsFriendly ? 0.65 : 0.9;
  const optionsRatio = Math.max(0, 1 - shareRatio);
  const shareCapital = Math.round(safeCapital * shareRatio);
  const optionsCapital = Math.round(safeCapital * optionsRatio);
  const marketStatus = useMemo(() => {
    const now = new Date();
    const day = now.getUTCDay();
    if (day === 0 || day === 6) return { label: "Weekend Planning Mode", detail: "Live momentum frozen. Focus on scenario planning.", mode: "weekend" };
    const minutes = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (minutes >= 810 && minutes < 1200) return { label: "Market Hours", detail: "Live refresh enabled with higher cadence.", mode: "open" };
    if (minutes >= 570 && minutes < 810) return { label: "Premarket Conditions", detail: "Liquidity still forming; confidence slightly discounted.", mode: "pre" };
    return { label: "After-Hours Conditions", detail: "Low liquidity environment; use conservative deployment.", mode: "after" };
  }, []);
  const now = new Date();
  const selectedPrice = selectedItem?.price ?? 0;
  const shareEntry = parseDollarRange(selectedItem?.deployment?.entryRange) ?? selectedPrice;
  const shareStop = parseDollarRange(selectedItem?.deployment?.stopRange) ?? selectedPrice * 0.93;
  const shareTarget = parseDollarRange(selectedItem?.deployment?.targetRange) ?? selectedPrice * 1.12;
  const shareQuantity = shareEntry > 0 ? Math.max(0, Math.floor(shareCapital / shareEntry)) : 0;
  const shareUsedCapital = Number((shareQuantity * shareEntry).toFixed(2));
  const shareProfitAtTarget = Number((shareQuantity * Math.max(0, shareTarget - shareEntry)).toFixed(2));

  const trapRisk = selectedItem?.whale?.trapRisk ?? "Unknown";
  const hypeRisk = selectedItem?.sentiment?.sentimentState === "Hype Risk";
  const swingAvoid = selectedItem?.swing?.bias === "Swing Avoid";
  const primaryNeither = selectedItem?.primaryOpportunity === "Neither";
  const choppyMarket = selectedItem?.macro?.terrain === "Choppy Market";
  const longStrong = selectedItem?.longTerm?.longTermQuality === "Strong";
  const swingWeak = selectedItem?.swing?.momentumQuality === "Weak" || swingAvoid;
  const leapPreferred = longStrong && swingWeak;

  const optionsReason = trapRisk === "High"
    ? "Whale trap risk is High."
    : swingAvoid
      ? "Swing setup is Avoid; short-dated calls are blocked."
      : primaryNeither
        ? "Primary opportunity is Neither, so aggressive options are not justified."
        : hypeRisk
          ? "Sentiment is Hype Risk; avoid chasing premium."
          : "";
  const optionsRecommended = optionsCapital > 0 && optionsReason.length === 0;
  const optionType = selectedItem?.deployment?.preferredInstrument === "Puts" ? "Puts" : "Calls";
  const optionDteDays = leapPreferred ? 270 : selectedItem?.macro?.volatilityState === "Expansion" ? 55 : 38;
  const optionExpiryBase = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + optionDteDays));
  const optionExpiry = nextThirdFriday(optionExpiryBase.getUTCFullYear(), optionExpiryBase.getUTCMonth());
  const optionStrike = selectedPrice > 0 ? Number((optionType === "Calls" ? selectedPrice * 1.03 : selectedPrice * 0.97).toFixed(2)) : 0;
  const optionPremium = selectedPrice > 0 ? Number((selectedPrice * (leapPreferred ? 0.12 : 0.045)).toFixed(2)) : 0;
  const contractCost = optionPremium * 100;
  const contracts = contractCost > 0 ? Math.max(0, Math.floor(optionsCapital / contractCost)) : 0;
  const optionTotalCost = Number((contracts * contractCost).toFixed(2));
  const optionStopLoss = Number((optionPremium * (leapPreferred ? 0.75 : 0.65)).toFixed(2));
  const optionProfitTarget = Number((optionPremium * (leapPreferred ? 1.8 : 1.45)).toFixed(2));

  const saveFeedback = useCallback((outcome: CapitalFeedbackOutcome) => {
    if (!selectedItem) return;
    const payload = {
      symbol: selectedItem.symbol,
      timestamp: new Date().toISOString(),
      battlefieldSnapshot: selectedItem,
      recommendedAllocation: {
        sharesCapital: shareCapital,
        optionsCapital,
        sharesQty: shareQuantity,
        optionsContracts: contracts,
        optionType: optionsRecommended ? optionType : "none",
      },
      selectedTickerPrice: selectedPrice,
      outcome,
    };
    const storageKey = "capital-allocation-feedback-v1";
    const existing = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown[];
    window.localStorage.setItem(storageKey, JSON.stringify([payload, ...existing].slice(0, 250)));
  }, [contracts, optionType, optionsCapital, optionsRecommended, selectedItem, selectedPrice, shareCapital, shareQuantity]);

  return (
    <main className="intel-shell">
      <div className="intel-wrap">
        <header className="intel-topbar">
          <h1 className="intel-title">Battlefield Intelligence Console</h1>
          <p className="intel-meta">Generated {generatedAt ? new Date(generatedAt).toLocaleString() : "Unknown"}</p>
          <div className={`market-banner market-${marketStatus.mode}`}>
            <strong>{marketStatus.label}</strong>
            <span>{marketStatus.detail}</span>
            <em>Last refresh {new Date(refreshStamp).toLocaleTimeString()}</em>
          </div>
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
                <div className="grid-ops">
                  <article className="glass-card card-swing">
                    <h3>Swing Battlefield <InfoHelp title="Swing Battlefield" content="Measures tactical momentum, entry/stop/targets, confidence weighting, and risk-reward quality for short-horizon execution. Bullish means clean structure with favorable R:R. Dangerous means weak momentum or poor reward asymmetry." /></h3>
                    <div className="metric-row"><span>Confidence</span><strong>{swingPct}%</strong></div>
                    <div className="meter"><i style={{ width: `${swingPct}%` }} /></div>
                    <div className="metric-row"><span>Momentum</span><span className={toneClass(selectedItem.swing?.momentumQuality)}>{selectedItem.swing?.momentumQuality}</span></div>
                    <div className="entry-map"><div><label>Entry</label><b>{selectedItem.swing?.entryZone ?? "-"}</b></div><div><label>Stop</label><b>{selectedItem.swing?.stopZone ?? "-"}</b></div><div><label>T1</label><b>{selectedItem.swing?.target1 ?? "-"}</b></div><div><label>T2</label><b>{selectedItem.swing?.target2 ?? "-"}</b></div></div>
                  </article>

                  <article className="glass-card card-long">
                    <h3>Long-Term Battlefield <InfoHelp title="Long-Term Battlefield" content="Tracks accumulation quality, institutional sponsorship, expected horizon path, and LEAP suitability. Bullish = stronger base and durable trend. Dangerous = weak sponsorship or low long-term quality." /></h3>
                    <div className="metric-row"><span>Accumulation Quality</span><strong>{selectedItem.longTerm?.longTermQuality ?? "-"}</strong></div>
                    <div className="metric-row"><span>Institutional Strength</span><span className={toneClass(selectedItem.longTerm?.institutionalStrength)}>{selectedItem.longTerm?.institutionalStrength ?? "-"}</span></div>
                    <div className="metric-row"><span>LEAP Suitability</span><span className={toneClass(selectedItem.longTerm?.leapSuitability)}>{selectedItem.longTerm?.leapSuitability ?? "-"}</span></div>
                    <div className="metric-row"><span>Horizon</span><strong>{selectedItem.longTerm?.expected3M ?? "-"} / {selectedItem.longTerm?.expected6M ?? "-"} / {selectedItem.longTerm?.expected1Y ?? "-"}</strong></div>
                    <div className="meter long"><i style={{ width: `${longPct}%` }} /></div>
                  </article>

                  <article className="glass-card card-whale"><h3>Whale Intelligence <InfoHelp title="Whale Intelligence" content="Detects trap radar, exhaustion, squeeze probability, flow imbalance, and distribution behavior. Bullish = low trap risk with constructive flow. Dangerous = high trap risk, exhaustion, or distribution pockets." /></h3><div className="radar-grid"><div><small>Trap Radar</small><p className={toneClass(selectedItem.whale?.trapRisk)}>{selectedItem.whale?.trapRisk ?? "-"}</p></div><div><small>Exhaustion</small><p className={toneClass(selectedItem.whale?.exhaustionRisk)}>{selectedItem.whale?.exhaustionRisk ?? "-"}</p></div><div><small>Flow</small><p className={toneClass(selectedItem.whale?.unusualFlow)}>{selectedItem.whale?.unusualFlow ?? "-"}</p></div><div><small>Squeeze</small><p className={toneClass(selectedItem.whale?.squeezePotential)}>{selectedItem.whale?.squeezePotential ?? "-"}</p></div></div></article>

                  <article className="glass-card card-macro"><h3>Macro Terrain <InfoHelp title="Macro Terrain" content="Classifies risk-on/risk-off context, volatility compression/expansion, and sector pressure. Macro modifies deployment aggressiveness: favorable terrain allows size; hostile terrain requires tighter risk posture." /></h3><div className={`terrain-banner ${toneClass(selectedItem.macro?.terrain)}`}>{selectedItem.macro?.terrain ?? "Unknown"}</div><div className="metric-row"><span>Volatility</span><strong>{selectedItem.macro?.volatilityState ?? "-"}</strong></div><div className="metric-row"><span>Condition</span><strong>{selectedItem.macro?.sectorPressure ?? "-"}</strong></div><div className="metric-row"><span>Sentiment</span><strong>{selectedItem.sentiment?.sentimentState ?? "-"}</strong></div></article>

                  <article className="glass-card card-deploy"><h3>Deployment Panel <InfoHelp title="Deployment Panel" content="Explains why shares vs calls vs puts vs LEAPS are selected and how aggressiveness shifts from starter-only to full-size. Confidence blends swing quality, long-term structure, macro terrain, and whale trap risk." /></h3><div className="deployment-mix">{instrumentMix(selectedItem.deployment).map((slot) => <span key={slot.label} className={slot.on ? "active" : "inactive"}>{slot.label}</span>)}</div><div className="metric-row"><span>Aggressiveness</span><strong>{selectedItem.deployment?.sizingAggressiveness ?? "-"}</strong></div><div className="meter"><i style={{ width: `${aggressivePct}%` }} /></div><div className="entry-map"><div><label>Entry</label><b>{selectedItem.deployment?.entryRange ?? "-"}</b></div><div><label>Stop</label><b>{selectedItem.deployment?.stopRange ?? "-"}</b></div><div><label>Target</label><b>{selectedItem.deployment?.targetRange ?? "-"}</b></div><div><label>Return Band</label><b>{selectedItem.deployment?.estimatedReturn ?? "-"}</b></div></div></article>
                  <article className="glass-card card-capital"><h3>Capital Allocation Engine <InfoHelp title="Capital Allocation Engine" content="Translates battlefield probability into deployable capital structure. Bullish setup can support hybrid shares+options. Neutral favors starter size. Dangerous suppresses options and preserves cash." /></h3><div className="metric-row"><span>Total Capital</span><input className="capital-input" value={capitalInput} onChange={(event) => setCapitalInput(event.target.value)} /></div><div className="entry-map"><div><label>Shares Plan</label><b>${shareUsedCapital.toLocaleString()} • {shareQuantity} shares</b></div><div><label>Entry / Stop</label><b>${shareEntry.toFixed(2)} / ${shareStop.toFixed(2)}</b></div><div><label>Target</label><b>${shareTarget.toFixed(2)} (Est. Profit ${shareProfitAtTarget.toLocaleString()})</b></div><div><label>Structure</label><b>{optionsCapital > 0 ? `${Math.round(shareRatio * 100)}% Shares + ${Math.round(optionsRatio * 100)}% ${selectedItem.deployment?.preferredInstrument === "LEAPS" ? "LEAPS" : "Calls"}` : "100% Shares"}</b></div><div><label>Market State</label><b>{marketStatus.label} • {now.toUTCString()}</b></div><div><label>Options Plan</label><b>{optionsRecommended ? `${optionType} ${optionExpiry.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} $${optionStrike} @ ~$${optionPremium}` : `Options not recommended because: ${optionsReason || "Risk profile does not justify options exposure."}`}</b></div>{optionsRecommended ? <><div><label>Contracts / Cost</label><b>{contracts} contracts • ${optionTotalCost.toLocaleString()}</b></div><div><label>Option Stop / Target</label><b>${optionStopLoss.toFixed(2)} / ${optionProfitTarget.toFixed(2)}</b></div></> : null}<div><label>Reason</label><b>{trapHigh ? "Trap risk elevated: suppress options." : choppyMarket ? "Choppy market: reduce size and favor shares." : leapPreferred ? "Long-term strong + swing weak: shares or LEAPS are preferred." : "Moderate risk: hybrid allocation allowed."}</b></div></div><div className="deployment-mix"><button type="button" onClick={() => saveFeedback("This worked")}>This worked</button><button type="button" onClick={() => saveFeedback("Stopped out")}>Stopped out</button><button type="button" onClick={() => saveFeedback("Target hit")}>Target hit</button><button type="button" onClick={() => saveFeedback("Bad signal")}>Bad signal</button><button type="button" onClick={() => saveFeedback("Wrong instrument")}>Wrong instrument</button></div></article>
                </div>
              </section>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

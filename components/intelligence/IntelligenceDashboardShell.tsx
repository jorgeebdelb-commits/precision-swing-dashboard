"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import type { BattlefieldApiResponse, BattlefieldOutput } from "@/lib/intelligence/types/battlefield";
import { resolveBattlefieldState } from "@/lib/intelligence/resolver/battlefieldStateResolver";

type Timeframe = "5m" | "15m" | "1H" | "4H" | "1D" | "1W";

interface IntelligenceDashboardShellProps { initialData: BattlefieldApiResponse; }

const stateColors: Record<string, string> = { READY: "state-ready", SETUP: "state-setup", WATCH: "state-watch", AVOID: "state-avoid" };

const tfOptions: Timeframe[] = ["5m", "15m", "1H", "4H", "1D", "1W"];

function parseDollarRange(value?: string) {
  if (!value) return null;
  const matches = value.match(/-?\d+(?:\.\d+)?/g);
  if (!matches || matches.length === 0) return null;
  const numbers = matches.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  if (numbers.length === 0) return null;
  return numbers.reduce((sum, item) => sum + item, 0) / numbers.length;
}

function engineState(resolved: ReturnType<typeof resolveBattlefieldState> | null) {
  const p = resolved?.primaryOpportunity ?? "WATCH";
  if (p.toLowerCase().includes("avoid") || p.toLowerCase().includes("risk-off")) return "AVOID";
  if (p.toLowerCase().includes("watch") || p.toLowerCase().includes("neutral")) return "WATCH";
  if (resolved?.battlefieldState?.toLowerCase().includes("ready")) return "READY";
  if ((resolved?.confidenceAdjusted ?? 0) >= 75) return "READY";
  return "SETUP";
}

export default function IntelligenceDashboardShell({ initialData }: IntelligenceDashboardShellProps) {
  const [watchlistSymbols, setWatchlistSymbols] = useState(() => (Array.isArray(initialData?.items) ? [...new Set(initialData.items.map((item) => item.symbol).filter(Boolean))].sort() : []));
  const [itemsBySymbol, setItemsBySymbol] = useState<Record<string, BattlefieldOutput>>(() => Object.fromEntries((initialData?.items ?? []).map((item) => [item.symbol, item])));
  const [selectedSymbol, setSelectedSymbol] = useState(() => watchlistSymbols[0] ?? "");
  const [search, setSearch] = useState("");
  const [addInput, setAddInput] = useState("");
  const [generatedAt, setGeneratedAt] = useState(initialData?.generatedAt ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capitalInput, setCapitalInput] = useState("5000");
  const [timeframe, setTimeframe] = useState<Timeframe>("1D");
  const [removingSymbols, setRemovingSymbols] = useState<Record<string, boolean>>({});
  const [utilitiesOpen, setUtilitiesOpen] = useState(false);

  const refreshSymbol = useCallback(async (symbol: string, force = true) => {
    const target = symbol.trim().toUpperCase(); if (!target) return;
    setLoading(true); setError(null);
    try {
      const response = await fetch(`/api/intelligence/refresh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ symbols: [target], force }) });
      if (!response.ok) throw new Error("Failed");
      const payload = (await response.json()) as BattlefieldApiResponse;
      const next = payload.items?.[0]; if (!next) throw new Error("No data");
      setItemsBySymbol((prev) => ({ ...prev, [target]: next }));
      setGeneratedAt(payload.generatedAt ?? new Date().toISOString());
    } catch { setError("Live market data unavailable"); } finally { setLoading(false); }
  }, []);

  const selectedItem = selectedSymbol ? itemsBySymbol[selectedSymbol] : null;
  const resolvedBySymbol = useMemo(() => Object.fromEntries(Object.entries(itemsBySymbol).map(([symbol, item]) => [symbol, resolveBattlefieldState(item)])), [itemsBySymbol]);
  const resolved = selectedSymbol ? resolvedBySymbol[selectedSymbol] : null;

  const groupedSymbols = useMemo(() => {
    const query = search.trim().toUpperCase();
    const list = watchlistSymbols.filter((s) => (!query ? true : s.includes(query)));
    return list.reduce<Record<string, string[]>>((acc, symbol) => {
      const state = engineState(resolvedBySymbol[symbol]);
      acc[state] = [...(acc[state] ?? []), symbol]; return acc;
    }, { READY: [], SETUP: [], WATCH: [], AVOID: [] });
  }, [resolvedBySymbol, search, watchlistSymbols]);

  const chartLevels = useMemo(() => {
    const price = selectedItem?.price ?? 0;
    const entry = parseDollarRange(selectedItem?.deployment?.entryRange) ?? price * 1.01;
    const stop = parseDollarRange(selectedItem?.deployment?.stopRange) ?? price * 0.96;
    const target1 = parseDollarRange(selectedItem?.swing?.target1) ?? price * 1.05;
    const target2 = parseDollarRange(selectedItem?.swing?.target2) ?? price * 1.1;
    return { price, entry, stop, target1, target2, lr50: price * 0.99, lr100: price * 0.97, vwap: price * 1.002, support: price * 0.95, resistance: price * 1.08 };
  }, [selectedItem]);

  const candles = useMemo(() => {
    const base = chartLevels.price || 100;
    return Array.from({ length: 40 }, (_, i) => {
      const drift = Math.sin(i / 4) * 1.8 + (i - 20) * 0.04;
      const open = base + drift + (Math.random() - 0.5) * 1.2;
      const close = open + (Math.random() - 0.5) * 2.4;
      const high = Math.max(open, close) + Math.random() * 1.5;
      const low = Math.min(open, close) - Math.random() * 1.5;
      return { open, close, high, low, volume: 40 + Math.random() * 80 };
    });
  }, [chartLevels.price]);

  const onSelectSymbol = useCallback((symbol: string) => { setSelectedSymbol(symbol); void refreshSymbol(symbol, true); }, [refreshSymbol]);
  const removeSymbol = useCallback(async (symbol: string) => { if (removingSymbols[symbol]) return; setRemovingSymbols((p) => ({ ...p, [symbol]: true })); setWatchlistSymbols((prev) => prev.filter((x) => x !== symbol)); try { await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" }); } finally { setRemovingSymbols((p) => { const n = { ...p }; delete n[symbol]; return n; }); } }, [removingSymbols]);
  const onAddSymbol = useCallback(async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); const symbol = addInput.trim().toUpperCase(); if (!/^[A-Z]{1,6}$/.test(symbol)) return; if (!watchlistSymbols.includes(symbol)) setWatchlistSymbols((prev) => [...prev, symbol].sort()); setSelectedSymbol(symbol); setAddInput(""); await refreshSymbol(symbol, true); }, [addInput, refreshSymbol, watchlistSymbols]);

  const totalCapital = Number(capitalInput.replace(/[^\d.]/g, "")) || 0;

  return <main className="intel-v9"><div className="regime-banner">MARKET REGIME: {selectedItem?.macro?.terrain ?? "Unknown"} • QQQ {selectedItem?.macro?.sectorPressure ?? "Mixed"} • VIX {selectedItem?.macro?.volatilityState ?? "N/A"}</div><div className="layout-v9">
    <aside className="watch-sidebar"><div className="watch-head"><h2>Watchlists</h2><button onClick={() => selectedSymbol && void refreshSymbol(selectedSymbol)}>{loading ? "…" : "Refresh"}</button></div><form className="add-symbol" onSubmit={onAddSymbol}><input value={addInput} onChange={(e) => setAddInput(e.target.value.toUpperCase())} placeholder="+Ticker" /><button type="submit">Add</button></form><input className="watch-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />{(["READY", "SETUP", "WATCH", "AVOID"] as const).map((group) => <section key={group}><h3>{group}</h3><div className="watch-group">{groupedSymbols[group].map((symbol) => { const r = resolvedBySymbol[symbol]; return <div className={`watch-item ${selectedSymbol === symbol ? "selected" : ""}`} key={symbol}><button onClick={() => onSelectSymbol(symbol)}><span>{symbol}</span><span className={stateColors[group]}>{Math.round(r?.confidenceAdjusted ?? 0)}</span><span>{(r?.primaryOpportunity?.toLowerCase().includes("risk") ? "↓" : r?.primaryOpportunity?.toLowerCase().includes("watch") ? "→" : "↑")}</span></button><button className="watch-remove" onClick={() => void removeSymbol(symbol)} disabled={Boolean(removingSymbols[symbol])}>×</button></div>; })}</div></section>)}</aside>
    <section className="main-console">
      <header className="console-head"><h1>V9 Trading Intelligence Console</h1><small>Generated {generatedAt ? new Date(generatedAt).toLocaleString() : "-"}</small></header>
      {error ? <p className="intel-alert">{error}</p> : null}
      <section className="chart-card"><div className="chart-toolbar"><div className="tf-group">{tfOptions.map((tf) => <button key={tf} className={timeframe === tf ? "active" : ""} onClick={() => setTimeframe(tf)}>{tf}</button>)}</div><div className="bias-mini"><span>Bullish</span><span>Neutral</span><span>Bearish</span></div></div>
        <div className="chart-area">{candles.map((c, i) => <div key={i} className="candle" style={{ left: `${(i / candles.length) * 100}%` }}><i className="wick" style={{ height: `${Math.max(18, (c.high - c.low) * 6)}px` }} /><b className={c.close >= c.open ? "up" : "down"} style={{ height: `${Math.max(8, Math.abs(c.close - c.open) * 8)}px` }} /></div>)}<div className="line entry">Entry {chartLevels.entry.toFixed(2)}</div><div className="line stop">Stop {chartLevels.stop.toFixed(2)}</div><div className="line target">T1 {chartLevels.target1.toFixed(2)}</div></div>
        <div className="trigger-text">Breakout above {chartLevels.entry.toFixed(2)} • Volume &gt;= 1.2x avg • Invalid below {chartLevels.stop.toFixed(2)}</div>
      </section>
      <section className="intel-panels">{[
        ["Swing Engine", selectedItem?.swing?.momentumQuality, selectedItem?.swing?.confidence, selectedItem?.swing?.entryZone, selectedItem?.swing?.riskReward],
        ["Long-Term Engine", selectedItem?.longTerm?.institutionalStrength, selectedItem?.longTerm?.confidence, selectedItem?.longTerm?.expected6M, selectedItem?.longTerm?.leapSuitability],
        ["Whale Intelligence", selectedItem?.whale?.unusualFlow, resolved?.confidenceAdjusted, selectedItem?.whale?.trapRisk, selectedItem?.whale?.exhaustionRisk],
        ["Macro Terrain", selectedItem?.macro?.terrain, resolved?.confidenceAdjusted, selectedItem?.macro?.sectorPressure, selectedItem?.macro?.volatilityState],
      ].map(([title, direction, score, reason, risk]) => <article className="intel-panel" key={String(title)}><h3>{title}</h3><p>{String(direction ?? "Neutral")}</p><p>Score {Math.round(Number(score) || 0)}</p><p>{String(reason ?? "No reason")}</p><small>Risk contribution: {String(risk ?? "Moderate")}</small></article>)}</section>
      <section className="execution-console"><h2>Execution Console</h2><div className="exec-state">{engineState(resolved) === "READY" ? "EXECUTION READY" : engineState(resolved) === "SETUP" ? "WAITING FOR CONFIRMATION" : "MONITOR ONLY"}</div><div className="exec-grid"><div>State <b>{resolved?.battlefieldState ?? "N/A"}</b></div><div>Strategy <b>{selectedItem?.deployment?.preferredInstrument ?? "N/A"}</b></div><div>Position Tier <b>{selectedItem?.deployment?.sizingAggressiveness ?? "N/A"}</b></div><div>Trigger <b>{selectedItem?.deployment?.entryRange ?? "N/A"}</b></div><div>Confirmation <b>{selectedItem?.swing?.momentumQuality ?? "N/A"}</b></div><div>Invalidation <b>{selectedItem?.deployment?.stopRange ?? "N/A"}</b></div><div>Stop <b>{selectedItem?.deployment?.stopRange ?? "N/A"}</b></div><div>Targets <b>{selectedItem?.deployment?.targetRange ?? "N/A"}</b></div><div>Tradeability <b>{resolved?.deploymentPermission.reason ?? "N/A"}</b></div><div>Risk <b>{resolved?.riskFlags?.join(", ") ?? "Normal"}</b></div></div></section>
      <section className="allocation"><h2>Capital Allocation Engine</h2><div className="alloc-grid"><label>Total Capital<input value={capitalInput} onChange={(e) => setCapitalInput(e.target.value)} /></label><div>Risk Style <b>{selectedItem?.deployment?.sizingAggressiveness ?? "Starter"}</b></div><div>Horizon Focus <b>{timeframe}</b></div><div>Shares allocation <b>{Math.round(totalCapital * 0.7).toLocaleString()}</b></div><div>Calls allocation <b>{Math.round(totalCapital * 0.2).toLocaleString()}</b></div><div>Cash reserve <b>{Math.round(totalCapital * 0.1).toLocaleString()}</b></div><div>Position size % <b>2.5%</b></div><div>Max portfolio risk <b>1.0%</b></div></div></section>
    </section>
  </div><footer className={`utilities ${utilitiesOpen ? "open" : ""}`}><button onClick={() => setUtilitiesOpen((x) => !x)}>System Utilities</button>{utilitiesOpen ? <div className="util-grid"><div>Market Data Status: {selectedItem?.marketDataState ?? "N/A"}</div><div>Weekend Planning Mode: {new Date().getUTCDay() === 0 || new Date().getUTCDay() === 6 ? "ON" : "OFF"}</div><div>Feed diagnostics: {selectedItem?.lastQuoteError ?? "Healthy"}</div></div> : null}</footer></main>;
}

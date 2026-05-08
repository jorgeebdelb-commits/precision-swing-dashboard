"use client";

import { useEffect, useMemo, useState } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import { normalizeBattlefieldRows } from "@/lib/intelligence/normalizeBattlefield";

function getRawShape(input: unknown): string {
  if (input === null) return "null";
  if (input === undefined) return "undefined";
  if (Array.isArray(input)) return `array(${input.length})`;
  if (typeof input === "object") return `object keys: ${Object.keys(input as Record<string, unknown>).join(", ") || "none"}`;
  return typeof input;
}

export default function DashboardClientShell() {
  const [rawApi, setRawApi] = useState<unknown>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>("");
  const [moduleFailures, setModuleFailures] = useState<string[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/intelligence", { cache: "no-store" });
        const json = await res.json();
        if (mounted) setRawApi(json);
      } catch (error) {
        if (mounted) {
          setRawApi(null);
          setModuleFailures((prev) => [...prev, `intelligence fetch failed: ${String((error as Error)?.message ?? error)}`]);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const normalizedRows = useMemo(() => normalizeBattlefieldRows(rawApi), [rawApi]);
  const symbols = useMemo(() => (Array.isArray(normalizedRows) ? normalizedRows.map((row) => row?.symbol ?? "UNKNOWN") : []), [normalizedRows]);

  return (
    <main style={{ padding: 20, color: "#e2e8f0", background: "#020617", minHeight: "100vh" }}>
      <h1>Precision Swing Dashboard (Stabilized Runtime Mode)</h1>

      <ErrorBoundary onError={(e) => setModuleFailures((prev) => [...prev, `shell error: ${e.message}`])}>
        <section style={{ border: "1px solid #334155", borderRadius: 10, padding: 12, marginBottom: 16 }}>
          <h2>Raw Symbols List</h2>
          {symbols.length === 0 ? <p>No symbols available.</p> : null}
          <ul>
            {(Array.isArray(symbols) ? symbols : []).map((symbol, idx) => (
              <li key={`${symbol}-${idx}`}>
                <button onClick={() => setSelectedSymbol(symbol)}>{symbol}</button>
              </li>
            ))}
          </ul>
        </section>
      </ErrorBoundary>

      <ErrorBoundary onError={(e) => setModuleFailures((prev) => [...prev, `debug panel error: ${e.message}`])}>
        <section style={{ border: "1px solid #334155", borderRadius: 10, padding: 12 }}>
          <h2>Debug Panel</h2>
          <p>symbols count: {Array.isArray(symbols) ? symbols.length : 0}</p>
          <p>normalized rows count: {Array.isArray(normalizedRows) ? normalizedRows.length : 0}</p>
          <p>raw API response shape: {getRawShape(rawApi)}</p>
          <p>selected symbol: {selectedSymbol || "(none)"}</p>
          <p>module failures: {(Array.isArray(moduleFailures) ? moduleFailures.length : 0) || 0}</p>
          <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto", fontSize: 12 }}>{JSON.stringify(rawApi, null, 2)}</pre>
        </section>
      </ErrorBoundary>
    </main>
  );
}

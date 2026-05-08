"use client";
import { useMemo, useState } from "react";
import { defaultSymbols } from "@/lib/intelligence/mock/mockBattlefield";
import { buildBattlefield } from "@/lib/intelligence/router/battlefieldRouter";

export default function BattlefieldConsole() {
  const [watchlist, setWatchlist] = useState<string[]>([...defaultSymbols]);
  const [selected, setSelected] = useState<string>(defaultSymbols[0]);
  const data = useMemo(() => buildBattlefield(watchlist), [watchlist]);
  const current = data.find((d) => d.symbol === selected) ?? data[0];

  return <main className="min-h-screen bg-slate-950 text-slate-100 p-4 grid grid-cols-12 gap-4">
    <aside className="col-span-2 rounded-2xl bg-slate-900/70 border border-cyan-900 p-3">
      <h2 className="text-cyan-300 font-semibold">Watchlist</h2>
      {watchlist.map((s)=><button key={s} onClick={()=>setSelected(s)} className="block w-full text-left p-2 mt-1 rounded hover:bg-slate-800">{s}</button>)}
      <button onClick={()=>setWatchlist([])} className="mt-4 text-xs text-amber-300">Clear watchlist</button>
    </aside>
    <section className="col-span-7 rounded-2xl bg-slate-900/70 border border-slate-700 p-4">
      {!current ? <div className="text-slate-400">No symbols loaded.</div> : <>
        <div className="flex justify-between"><h1 className="text-2xl font-bold">{current.symbol} Battlefield</h1><span>${current.price}</span></div>
        <div className="grid grid-cols-2 gap-3 mt-3 text-sm">
          <Card t="Swing Battlefield" v={current.swingDirection} />
          <Card t="Long-Term Battlefield" v={current.longDirection} />
          <Card t="Whale Intelligence" v={current.whale.status} />
          <Card t="Macro Terrain" v={current.macro.status} />
          <Card t="Political Risk" v={current.politics.status} />
          <Card t="Sentiment" v={current.sentiment.status} />
          <Card t="Capital Deployment" v={current.deployment.mode} />
          <Card t="Entry / Exit" v={`${current.deployment.entryZone} → ${current.deployment.targets.join(", ")}`} />
        </div>
      </>}
    </section>
    <aside className="col-span-3 rounded-2xl bg-slate-900/70 border border-slate-700 p-4">
      <h3 className="font-semibold text-cyan-300">Summary</h3>
      <p className="text-sm mt-2">Top bar: Market Open · VIX 18.4 · Risk-On · Deployment Tactical.</p>
      <ul className="text-sm mt-2 list-disc pl-4">{current?.alerts?.map((a)=><li key={a}>{a}</li>)}</ul>
    </aside>
  </main>;
}
function Card({t,v}:{t:string;v:string}){return <div className="rounded-xl p-3 bg-slate-800/80 border border-slate-700"><p className="text-slate-400 text-xs">{t}</p><p className="font-medium">{v}</p></div>}

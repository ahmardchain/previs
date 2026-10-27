"use client";
import Link from "next/link";
import { useState } from "react";
import type { Market } from "@/lib/markets";
import { formatVolume } from "@/lib/markets";
import type { AdviceDTO, PickDTO, Side } from "@/lib/types";
import { CopilotChat } from "@/components/CopilotChat";
import { useUser } from "@/components/UserProvider";

function Chart({ data }: { data: number[] }) {
  const W = 800, H = 240;
  const min = Math.min(...data) - 4, max = Math.max(...data) + 4;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * W, H - ((v - min) / (max - min)) * H] as const);
  const line = pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" role="img" aria-label={`Yes price over time, now ${data[data.length - 1]}%`}>
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#34d399" stopOpacity=".22" /><stop offset="1" stopColor="#34d399" stopOpacity="0" /></linearGradient></defs>
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="#1c1c1f" />)}
      <polygon fill="url(#g)" points={`${line} ${W},${H} 0,${H}`} />
      <polyline className="draw" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinejoin="round" points={line} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MarketView({ market }: { market: Market }) {
  const { userId } = useUser();
  const [side, setSide] = useState<Side>("yes");
  const [amount, setAmount] = useState(25);
  const [phase, setPhase] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");
  const price = side === "yes" ? market.yes : 100 - market.yes;
  const toWin = amount > 0 ? (amount * 100) / price : 0;

  function applyAdvice(a: AdviceDTO) {
    setSide(a.side);
    setAmount(a.amount);
    setPhase("idle");
    document.getElementById("ticket")?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  async function place() {
    if (!userId || amount <= 0) return;
    setPhase("saving");
    const r = await fetch("/api/picks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, marketId: market.id, side, stake: amount, source: "user" }),
    });
    const d = (await r.json()) as PickDTO & { error?: string };
    if (!r.ok) { setMsg(d.error ?? "Couldn't place"); setPhase("error"); return; }
    setMsg(d.checkpoint ? `Saved at Sui checkpoint #${d.checkpoint}` : "Saved to your memory");
    setPhase("done");
  }

  const yesStyle = side === "yes"
    ? { background: "var(--yes)", color: "#052e1f", borderColor: "var(--yes)" }
    : { background: "rgba(52,211,153,.08)", color: "var(--yes-text)", borderColor: "rgba(52,211,153,.3)" };
  const noStyle = side === "no"
    ? { background: "var(--no)", color: "#3b0a14", borderColor: "var(--no)" }
    : { background: "rgba(251,113,133,.08)", color: "var(--no-text)", borderColor: "rgba(251,113,133,.3)" };

  return (
    <main className="container" style={{ paddingTop: 24, paddingBottom: 64, display: "flex", flexDirection: "column", gap: 20 }}>
      <Link href="/" className="btn btn-ghost" style={{ alignSelf: "flex-start", minHeight: 40, fontSize: 13, letterSpacing: ".14em", color: "var(--muted)" }}>← ALL MARKETS</Link>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <div style={{ flex: "999 1 560px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card fade-up" style={{ padding: 26, borderRadius: 28, display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ flex: "none", width: 56, height: 56, borderRadius: 999, background: "var(--raise)", display: "grid", placeItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 15, color: "#d4d4d8" }}>{market.icon}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span className="eyebrow">{market.category} · {market.league}{market.live ? " · Live" : ""}</span>
                <h1 className="display" style={{ margin: 0, fontSize: "clamp(26px, 4vw, 36px)", lineHeight: 1.1, fontWeight: 700 }}>{market.title}</h1>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 36, alignItems: "flex-end" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">Yes chance</span>
                <span className="display" style={{ fontSize: 52, lineHeight: 1, fontWeight: 800, color: "var(--yes)" }}>{market.yes}%</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">24h</span>
                <span className="display" style={{ fontSize: 22, fontWeight: 700, color: market.move24h >= 0 ? "var(--yes)" : "var(--no)" }}>{market.move24h >= 0 ? "+" : ""}{market.move24h}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span className="eyebrow">Volume</span>
                <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>{formatVolume(market.volume)}</span>
              </div>
            </div>
            <Chart data={market.history} />
          </section>

          <section id="ticket" aria-label="Trade ticket" className="card" style={{ padding: 18, borderRadius: 28, display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 100 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button className="btn" aria-pressed={side === "yes"} style={{ minHeight: 52, borderRadius: 16, fontSize: 15, ...yesStyle }} onClick={() => { setSide("yes"); setPhase("idle"); }}>Yes {market.yes}¢</button>
              <button className="btn" aria-pressed={side === "no"} style={{ minHeight: 52, borderRadius: 16, fontSize: 15, ...noStyle }} onClick={() => { setSide("no"); setPhase("idle"); }}>No {100 - market.yes}¢</button>
            </div>
            <div className="inset" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                <span className="eyebrow">Amount</span>
                <span className="display" style={{ fontSize: 40, lineHeight: 1, fontWeight: 700 }}>${amount}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {[1, 5, 10, 100].map((v) => (
                  <button key={v} className="tab" style={{ flex: 1, minHeight: 40, background: "#18181b" }} onClick={() => { setAmount((a) => Math.min(1000, a + v)); setPhase("idle"); }}>+{v}</button>
                ))}
                <button className="tab" style={{ flex: 1, minHeight: 40, color: "var(--lime)", background: "transparent" }} onClick={() => setAmount(0)}>Clear</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14 }}>
              <span className="muted">To win</span><b style={{ color: "var(--yes)" }}>${toWin.toFixed(2)}</b>
            </div>
            <button className="btn btn-lime" style={{ minHeight: 56, fontSize: 15 }} disabled={phase === "saving" || amount <= 0} onClick={place}>
              {phase === "saving" ? "Saving your pick…" : phase === "done" ? "Placed ✓" : `Buy ${side === "yes" ? "Yes" : "No"} · paper`}
            </button>
            <span style={{ fontSize: 12, color: phase === "error" ? "var(--no-text)" : "var(--faint)", textAlign: "center" }}>
              {phase === "done" || phase === "error" ? msg : "Paper trading only. No real funds are used."}
            </span>
          </section>
        </div>

        <aside className="card" style={{ flex: "1 1 380px", minWidth: 0, borderRadius: 28, overflow: "hidden", display: "flex", flexDirection: "column", height: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: "1px solid var(--line-soft)" }}>
            <span aria-hidden="true" style={{ width: 36, height: 36, borderRadius: 999, background: "var(--lime)", display: "grid", placeItems: "center" }}>
              <svg width="22" height="22" viewBox="0 0 30 30"><circle cx="15" cy="15" r="11" fill="none" stroke="#0a0a0b" strokeWidth="2.8" /><circle cx="15" cy="15" r="4.5" fill="#0a0a0b" /></svg>
            </span>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span className="display" style={{ fontWeight: 700, fontSize: 16, letterSpacing: 0 }}>AI Copilot</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}><span className="sync-dot" style={{ background: "var(--yes)" }} />Remembers you</span>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0 }}>
            <CopilotChat key={market.id} marketId={market.id} compact onUse={applyAdvice} />
          </div>
        </aside>
      </div>
    </main>
  );
}

"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/UserProvider";
import type { PickDTO } from "@/lib/types";
import { humanize } from "@/lib/humanize";

interface MemoryResp { mode: string; total: number; memories: { text: string; blobId: string; createdAt?: string }[] }
interface Wallet { sui: number; recentTxs: number; live: boolean }

export default function Portfolio() {
  const { userId, address } = useUser();
  const [picks, setPicks] = useState<PickDTO[] | null>(null);
  const [mem, setMem] = useState<MemoryResp | null>(null);
  const [walletData, setWallet] = useState<(Wallet & { address: string }) | null>(null);
  const wallet = walletData && walletData.address === address ? walletData : null;
  const [settling, setSettling] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!userId) return;
    fetch(`/api/picks?userId=${userId}`).then((r) => r.json()).then(setPicks).catch(() => setPicks([]));
    fetch(`/api/memory?userId=${userId}`).then((r) => r.json()).then(setMem).catch(() => {});
  }, [userId]);
  useEffect(load, [load]);
  useEffect(() => {
    if (!address) return;
    fetch(`/api/wallet?address=${address}`).then((r) => r.json()).then((d) => !d.error && setWallet(d)).catch(() => {});
  }, [address]);

  async function settle(marketId: string, outcome: "yes" | "no") {
    setSettling(marketId);
    await fetch("/api/resolve", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ marketId, outcome }) });
    setSettling(null);
    load();
  }

  const resolved = (picks ?? []).filter((p) => p.status !== "open");
  const wins = resolved.filter((p) => p.status === "won").length;
  const openMarkets = [...new Map((picks ?? []).filter((p) => p.status === "open").map((p) => [p.marketId, p.marketTitle])).entries()];
  const mine = mem?.memories ?? [];

  return (
    <main className="container" style={{ paddingTop: 40, paddingBottom: 80, display: "flex", flexDirection: "column", gap: 28 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="eyebrow">Portfolio</span>
        <h1 className="display" style={{ margin: 0, fontSize: 40, fontWeight: 700 }}>My picks</h1>
      </div>

      <section className="stagger" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="eyebrow">Record</span>
          <span className="display" style={{ fontSize: 30, fontWeight: 700 }}>{wins} / {resolved.length}</span>
          <span className="muted" style={{ fontSize: 13 }}>{resolved.length ? `${Math.round((wins / resolved.length) * 100)}% right` : "No results yet"}</span>
        </div>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="eyebrow">Open picks</span>
          <span className="display" style={{ fontSize: 30, fontWeight: 700 }}>{(picks ?? []).filter((p) => p.status === "open").length}</span>
          <span className="muted" style={{ fontSize: 13 }}>Waiting for results</span>
        </div>
        <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <span className="eyebrow">Copilot knows you</span>
          <span className="display" style={{ fontSize: 30, fontWeight: 700 }}>{mine.length} <span style={{ fontSize: 14, fontFamily: "var(--body)", color: "var(--muted)", fontWeight: 500 }}>memories</span></span>
          <span className="muted" style={{ fontSize: 13 }}>Stored on Walrus {mem?.mode === "mainnet" ? "Mainnet" : "(demo mode)"}</span>
        </div>
        {address && (
          <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="eyebrow">Sui wallet · via Tatum</span>
            <span className="display" style={{ fontSize: 30, fontWeight: 700 }}>{wallet?.live ? `${wallet.sui.toFixed(2)} SUI` : "—"}</span>
            <span className="muted" style={{ fontSize: 13 }}>{wallet?.live ? `${wallet.recentTxs} recent transactions` : "Add a Tatum key to read your wallet"}</span>
          </div>
        )}
      </section>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20, alignItems: "flex-start" }}>
        <section className="card" style={{ flex: "999 1 560px", minWidth: 0, padding: 22, display: "flex", flexDirection: "column" }}>
          <span className="eyebrow" style={{ marginBottom: 10 }}>Pick journal</span>
          {picks === null && <p className="muted">Loading…</p>}
          {picks && picks.length === 0 && (
            <p className="muted" style={{ lineHeight: 1.6 }}>No picks yet. <Link href="/">Pick a market</Link> or ask the <Link href="/copilot">AI Copilot</Link>.</p>
          )}
          {(picks ?? []).map((p) => (
            <div key={p.id} style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", padding: "14px 0", borderTop: "1px solid var(--line-soft)" }}>
              <span className="pill" style={{ fontWeight: 700, background: p.side === "yes" ? "rgba(52,211,153,.12)" : "rgba(251,113,133,.12)", color: p.side === "yes" ? "var(--yes-text)" : "var(--no-text)" }}>{p.side.toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 3 }}>
                <Link href={`/market/${p.marketId}`} style={{ color: "var(--text)", fontWeight: 600, fontSize: 14 }}>{p.marketTitle}</Link>
                <span style={{ fontSize: 12, color: "var(--faint)", wordBreak: "break-all" }}>
                  ${p.stake} · {new Date(p.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                  {p.source === "copilot" ? " · copilot's call" : ""}
                  {p.checkpoint ? ` · Sui #${p.checkpoint}` : ""} · {p.fingerprint.slice(0, 10)}
                </span>
              </div>
              <span className="pill" style={{ border: "1px solid var(--line-strong)", color: p.status === "won" ? "var(--yes)" : p.status === "lost" ? "var(--no)" : "var(--muted)", fontWeight: 600 }}>
                {p.status === "open" ? "Open" : p.status === "won" ? "Won" : "Lost"}
              </span>
            </div>
          ))}
        </section>

        <aside style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 20 }}>
          <section className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="eyebrow">What the copilot remembers</span>
            {mine.length === 0 && <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>Nothing yet. Try telling the copilot “my limit is 5% per trade”.</p>}
            {mine.slice(0, 12).map((m) => (
              <div key={m.blobId + m.text} style={{ padding: "10px 12px", borderRadius: 14, background: "var(--inset)", border: "1px solid var(--line-soft)", fontSize: 13, lineHeight: 1.5 }}>
                {humanize(m.text)}
                <div style={{ fontSize: 11, color: "var(--faint)", marginTop: 4, wordBreak: "break-all" }}>{m.blobId.startsWith("local-") ? "demo memory" : m.blobId.startsWith("pending:") ? "Saving to Walrus Mainnet…" : m.blobId.startsWith("failed:") ? "Walrus write failed" : `Walrus blob ${m.blobId.slice(0, 20)}…`}</div>
              </div>
            ))}
          </section>

          {openMarkets.length > 0 && (
            <section className="card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="eyebrow">Demo · settle a market</span>
              <span className="muted" style={{ fontSize: 13, lineHeight: 1.5 }}>Simulates the final result so you can watch the copilot learn from it.</span>
              {openMarkets.map(([id, title]) => (
                <div key={id} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 0", borderTop: "1px solid var(--line-soft)" }}>
                  <span style={{ fontSize: 13 }}>{title}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" style={{ flex: 1, minHeight: 38 }} disabled={settling === id} onClick={() => settle(id, "yes")}>It was Yes</button>
                    <button className="btn btn-ghost" style={{ flex: 1, minHeight: 38 }} disabled={settling === id} onClick={() => settle(id, "no")}>It was No</button>
                  </div>
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}

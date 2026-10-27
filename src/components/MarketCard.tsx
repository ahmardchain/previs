"use client";
import Link from "next/link";
import { formatCloses, formatVolume } from "@/lib/markets";
import type { MarketDTO } from "@/lib/types";

function Spark({ data }: { data: number[] }) {
  const min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 56},${18 - ((v - min) / (max - min || 1)) * 16}`).join(" ");
  return (
    <svg width="56" height="20" viewBox="0 0 56 20" aria-hidden="true">
      <polyline fill="none" stroke="#52525b" strokeWidth="1.6" strokeLinejoin="round" points={pts} />
    </svg>
  );
}

function Row({ label, pct, yes, href }: { label: string; pct: number; yes: boolean; href: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "10px 10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{label}</span>
        <span title="What 1 pUSD pays if right" style={{ fontSize: 12, color: "var(--muted)", padding: "3px 8px", borderRadius: 999, border: "1px solid #27272a" }}>
          {(100 / pct).toFixed(1)}×
        </span>
        <Link href={href} className={`odds ${yes ? "odds-yes" : "odds-no"}`} aria-label={`Buy ${label} at ${pct}%`}>
          <span className="roll"><span>{pct}%</span><span>{label}</span></span>
        </Link>
      </div>
      <div className="bar"><div style={{ width: `${pct}%`, background: yes ? "var(--yes)" : "var(--no)" }} /></div>
    </div>
  );
}

export function MarketCard({ m }: { m: MarketDTO }) {
  const href = `/market/${m.id}`;
  return (
    <article className="card lift" style={{ display: "flex", flexDirection: "column", gap: 16, padding: 18 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <span aria-hidden="true" style={{ flex: "none", width: 48, height: 48, borderRadius: 999, background: "var(--raise)", display: "grid", placeItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 13, color: "#d4d4d8" }}>{m.icon}</span>
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <Link href={href} style={{ color: "var(--text)", fontFamily: "var(--display)", fontWeight: 600, fontSize: 16, lineHeight: 1.3 }}>{m.title}</Link>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}>
            {m.live && <span className="pulse-dot" />}
            {formatCloses(m)} · {m.league}
          </span>
        </div>
      </div>
      {m.resolved ? (
        <div className="inset" style={{ padding: 16, fontSize: 14 }}>
          Settled: <b style={{ color: m.resolved === "yes" ? "var(--yes)" : "var(--no)" }}>{m.resolved.toUpperCase()}</b>
        </div>
      ) : (
        <div className="inset" style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
          <Row label="Yes" pct={m.yes} yes href={href} />
          <Row label="No" pct={100 - m.yes} yes={false} href={href} />
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Spark data={m.history} />
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{formatVolume(m.volume)} vol.</span>
        <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 700, letterSpacing: ".06em", color: "var(--lime)" }}>
          COPILOT {m.pick.side.toUpperCase()}
        </span>
      </div>
    </article>
  );
}

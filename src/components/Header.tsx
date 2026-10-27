"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useUser } from "./UserProvider";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden="true">
      <circle cx="15" cy="15" r="13" fill="none" stroke="var(--lime)" strokeWidth="2.4" />
      <circle cx="15" cy="15" r="5" fill="var(--lime)" />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/copilot", label: "Copilot" },
];

export function Header() {
  const path = usePathname();
  const { address, connect, disconnect } = useUser();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState<{ walrus: string; tatum: string } | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const a = value.trim();
    if (!/^0x[0-9a-fA-F]{64}$/.test(a)) { setError("That doesn't look like a Sui address (0x + 64 characters)."); return; }
    connect(a);
    setOpen(false);
    setValue("");
    setError("");
    fetch(`/api/wallet?address=${a}`).catch(() => {});
  }

  return (
    <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(10,10,11,.85)", backdropFilter: "blur(12px)" }}>
      <div className="container" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, paddingTop: 14, paddingBottom: 14 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
          <Logo />
          <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 19, letterSpacing: ".14em" }}>PREVIS</span>
        </Link>
        <div style={{ flex: "1 1 auto", display: "flex", justifyContent: "center" }}>
          <nav aria-label="Main" style={{ display: "flex", gap: 4, padding: 5, borderRadius: 999, background: "var(--surface)", border: "1px solid var(--line)" }}>
            {NAV.map((n) => {
              const active = n.href === "/" ? path === "/" || path.startsWith("/market") : path.startsWith(n.href);
              return (
                <Link key={n.href} href={n.href} aria-current={active ? "page" : undefined} className="nav-pill"
                  style={{ padding: "9px 18px", borderRadius: 999, fontSize: 14, fontWeight: 600, whiteSpace: "nowrap",
                    background: active ? "#fff" : "transparent", color: active ? "var(--ink)" : "var(--muted)" }}>
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {status && (
          <span className="pill hide-sm" title="Where memories and on-chain reads go"
            style={{ minHeight: 44, padding: "0 14px", background: "var(--surface)", border: "1px solid var(--line)", color: "var(--muted)" }}>
            <span className="sync-dot" style={{ background: status.walrus === "mainnet" ? "var(--yes)" : "#fdba74" }} />
            Walrus {status.walrus === "mainnet" ? "Mainnet" : "demo"} · Tatum {status.tatum === "live" ? "live" : "demo"}
          </span>
        )}
        {address ? (
          <button className="btn btn-ghost" onClick={disconnect} title="Disconnect">
            {address.slice(0, 6)}…{address.slice(-4)}
          </button>
        ) : (
          <button className="btn btn-white" onClick={() => setOpen(true)}>Connect Wallet</button>
        )}
      </div>

      {open && (
        <div role="dialog" aria-modal="true" aria-label="Connect a Sui wallet"
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={submit} className="card fade-up" style={{ width: "min(460px, 100%)", padding: 24, display: "flex", flexDirection: "column", gap: 14 }}>
            <h2 className="display" style={{ margin: 0, fontSize: 22 }}>Connect your Sui wallet</h2>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
              Paste your Sui address. Previs reads your on-chain activity through Tatum so the copilot knows your level. Nothing is signed or moved.
            </p>
            <label>
              <span className="sr-only">Sui address</span>
              <input className="input" autoFocus placeholder="0x…" value={value} onChange={(e) => setValue(e.target.value)} />
            </label>
            {error && <span style={{ color: "var(--no-text)", fontSize: 13 }}>{error}</span>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
              <button type="submit" className="btn btn-lime">Connect</button>
            </div>
          </form>
        </div>
      )}
    </header>
  );
}

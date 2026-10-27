import Link from "next/link";
import { Logo } from "./Header";

const COLS: { title: string; links: { label: string; href: string; external?: boolean }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Markets", href: "/" },
      { label: "AI Copilot", href: "/copilot" },
      { label: "My picks", href: "/portfolio" },
    ],
  },
  {
    title: "Built on",
    links: [
      { label: "Walrus Memory", href: "https://docs.wal.app/walrus-memory/getting-started/quick-start", external: true },
      { label: "Tatum Sui RPC", href: "https://tatum.io/chain/sui", external: true },
      { label: "Sui", href: "https://sui.io", external: true },
    ],
  },
  {
    title: "Project",
    links: [
      { label: "GitHub", href: "https://github.com/ahmardchain/previs", external: true },
      { label: "Total Recall hackathon", href: "https://recall-tatum-walrus.vercel.app/", external: true },
      { label: "Builder on X", href: "https://x.com/ahmardchain", external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer style={{ borderTop: "1px solid var(--line-soft)", marginTop: 40 }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 110, display: "flex", flexDirection: "column", gap: 40 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 40, justifyContent: "space-between" }}>
          <div style={{ flex: "1 1 260px", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text)" }}>
              <Logo />
              <span style={{ fontFamily: "var(--display)", fontWeight: 700, fontSize: 19, letterSpacing: ".14em" }}>PREVIS</span>
            </Link>
            <p className="muted" style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
              Every call, on the record. A prediction copilot that remembers how you trade and saves each pick before the result.
            </p>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title} style={{ flex: "0 1 180px", display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{c.title}</span>
              {c.links.map((l) =>
                l.external ? (
                  <a key={l.label} href={l.href} target="_blank" rel="noreferrer" style={{ color: "var(--muted)", fontSize: 14 }}>{l.label} ↗</a>
                ) : (
                  <Link key={l.label} href={l.href} style={{ color: "var(--muted)", fontSize: 14 }}>{l.label}</Link>
                ),
              )}
            </nav>
          ))}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", paddingTop: 20, borderTop: "1px solid var(--line-soft)", fontSize: 13, color: "var(--faint)" }}>
          <span>© 2026 Previs. Built by AHMARD for Total Recall.</span>
          <span>Paper trading only — no real money is used. Not financial advice.</span>
        </div>
      </div>
    </footer>
  );
}

"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "./UserProvider";
import { Logo } from "./Header";
import type { AdviceDTO, CopilotReplyDTO, MarketDTO, PickDTO } from "@/lib/types";
import { humanize } from "@/lib/humanize";

type Msg = { role: "user"; text: string } | { role: "copilot"; reply: CopilotReplyDTO };

function AdviceCard({ a, onUse }: { a: AdviceDTO; onUse?: (a: AdviceDTO) => void }) {
  const { userId } = useUser();
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [receipt, setReceipt] = useState<PickDTO | null>(null);
  const [err, setErr] = useState("");
  const yes = a.side === "yes";

  async function savePick() {
    if (!userId) return;
    setState("saving");
    const r = await fetch("/api/picks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId, marketId: a.marketId, side: a.side, stake: a.amount, confidence: a.confidence, source: "copilot" }),
    });
    const d = await r.json();
    if (!r.ok) { setErr(d.error ?? "Couldn't save"); setState("error"); return; }
    setReceipt(d);
    setState("saved");
  }

  return (
    <div className="inset fade-up" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <span style={{ fontSize: 12, color: "var(--muted)" }}>{a.marketTitle}</span>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <span className="display" style={{ fontWeight: 800, fontSize: 30, color: yes ? "var(--yes)" : "var(--no)" }}>{yes ? "YES" : "NO"}</span>
        <span style={{ fontSize: 13, color: "var(--muted)" }}>{a.label} · <b style={{ color: "var(--text)" }}>{a.confidence}%</b></span>
      </div>
      <div className="bar" style={{ height: 8 }}><div style={{ width: `${a.confidence}%`, background: yes ? "var(--yes)" : "var(--no)" }} /></div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, lineHeight: 1.5 }}>
        {a.reasons.map((r) => (
          <div key={r} style={{ display: "flex", gap: 10 }}><span aria-hidden="true" style={{ color: "var(--yes)" }}>✓</span><span>{r}</span></div>
        ))}
      </div>

      {a.because.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 14, background: "rgba(198,242,78,.07)", border: "1px solid rgba(198,242,78,.25)" }}>
          <span className="eyebrow" style={{ color: "var(--lime)", fontSize: 10 }}>Because I remember</span>
          {a.because.map((b) => <span key={b} style={{ fontSize: 13, lineHeight: 1.5 }}>{b}</span>)}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "12px 14px", borderRadius: 16, background: "#18181b" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>Suggested amount</span>
          <span style={{ fontWeight: 700, fontSize: 18 }}>${a.amount}</span>
        </div>
        {onUse && <button className="btn btn-white" onClick={() => onUse(a)}>Use this</button>}
      </div>

      {state === "saved" && receipt ? (
        <div className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 6, padding: "12px 14px", borderRadius: 16, background: "rgba(198,242,78,.08)", border: "1px solid rgba(198,242,78,.3)" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 14 }}>
            <span className="pill shine" style={{ color: "var(--lime)", fontWeight: 700, letterSpacing: ".14em", fontSize: 10 }}>RECEIPT</span>
            Saved before the result
          </span>
          <span style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.6, wordBreak: "break-all" }}>
            {receipt.checkpoint ? <>Sui checkpoint #{receipt.checkpoint} · </> : null}
            {receipt.blobId?.startsWith("pending:") ? "Writing to Walrus Mainnet…" : `Walrus blob ${receipt.blobId?.slice(0, 18)}…`} · fingerprint {receipt.fingerprint.slice(0, 12)}
          </span>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button className="btn btn-lime" style={{ minHeight: 48 }} disabled={state === "saving"} onClick={savePick}>
            {state === "saving" ? <><span className="spin" style={{ width: 16, height: 16, border: "2px solid currentColor", borderRightColor: "transparent", borderRadius: 999 }} /> Saving…</> : "Save my pick"}
          </button>
          <span style={{ fontSize: 12, color: "var(--muted)", textAlign: "center", lineHeight: 1.5 }}>
            {state === "error" ? err : "Locks this pick in before the game so anyone can check it later."}
          </span>
        </div>
      )}
    </div>
  );
}

export function CopilotChat({ marketId, compact = false, onUse }: { marketId?: string; compact?: boolean; onUse?: (a: AdviceDTO) => void }) {
  const { userId } = useUser();
  const [markets, setMarkets] = useState<MarketDTO[]>([]);
  const [selected, setSelected] = useState<string | undefined>(marketId);
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/markets").then((r) => r.json()).then(setMarkets).catch(() => {}); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [msgs, busy]);

  const sel = markets.find((m) => m.id === selected);

  async function send(text: string) {
    const q = text.trim();
    if (!q || !userId || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setBusy(true);
    try {
      const r = await fetch("/api/copilot", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId, question: q, marketId: selected }),
      });
      const reply = (await r.json()) as CopilotReplyDTO;
      if (!r.ok) throw new Error(reply.error);
      setMsgs((m) => [...m, { role: "copilot", reply }]);
    } catch {
      setMsgs((m) => [...m, { role: "copilot", reply: { text: "Something went wrong. Try again in a moment.", suggestions: [] } }]);
    } finally {
      setBusy(false);
    }
  }

  const last = [...msgs].reverse().find((m) => m.role === "copilot") as Extract<Msg, { role: "copilot" }> | undefined;
  const chips = last?.reply.suggestions?.length ? last.reply.suggestions : sel ? ["What's your pick?", "Should I go big?", "What does the % mean?"] : ["Show me the best pick today", "My limit is 5% per trade", "I support Arsenal"];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, flex: 1 }}>
      <div style={{ flex: 1, overflowY: "auto", padding: compact ? 18 : "8px 0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {msgs.length === 0 ? (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", padding: compact ? 16 : "40px 0" }}>
            {compact ? <span style={{ opacity: .5 }}><Logo size={44} /></span> : (
              <span className="fade-up" style={{ width: 64, height: 64, borderRadius: 999, background: "var(--lime)", display: "grid", placeItems: "center" }}>
                <svg width="38" height="38" viewBox="0 0 30 30" aria-hidden="true"><circle cx="15" cy="15" r="11" fill="none" stroke="#0a0a0b" strokeWidth="2.6" /><circle cx="15" cy="15" r="4.5" fill="#0a0a0b" /></svg>
              </span>
            )}
            {!compact && <h1 className="display fade-up" style={{ margin: 0, fontSize: 36, fontWeight: 700 }}>Hi, I&apos;m your AI Copilot</h1>}
            <p className="muted" style={{ margin: 0, maxWidth: 420, lineHeight: 1.6, fontSize: compact ? 14 : 15 }}>
              {sel ? `Ask me anything about “${sel.title}”.` : "Pick any market below, or just ask. I'll give you a simple pick and how much to put in."}
            </p>
            {!compact && <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted)" }}><span className="sync-dot" style={{ background: "var(--yes)" }} />Remembers how you trade</span>}
          </div>
        ) : (
          msgs.map((m, i) =>
            m.role === "user" ? (
              <div key={i} className="fade-up" style={{ alignSelf: "flex-end", maxWidth: "85%", padding: "10px 14px", borderRadius: "18px 18px 6px 18px", background: "#fff", color: "var(--ink)", fontSize: 14, lineHeight: 1.45 }}>{m.text}</div>
            ) : (
              <div key={i} className="fade-up" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {m.reply.learned && (
                  <span className="pill" style={{ alignSelf: "flex-start", background: "rgba(198,242,78,.1)", color: "var(--lime)", fontSize: 12 }}>✓ Remembered: {humanize(m.reply.learned)}</span>
                )}
                <div style={{ alignSelf: "flex-start", maxWidth: "92%", padding: "10px 14px", borderRadius: "18px 18px 18px 6px", background: "var(--raise)", fontSize: 14, lineHeight: 1.55, whiteSpace: "pre-line" }}>{m.reply.text}</div>
                {m.reply.advice && <AdviceCard a={m.reply.advice} onUse={onUse} />}
              </div>
            ),
          )
        )}
        {busy && <div style={{ alignSelf: "flex-start", padding: "14px 16px", borderRadius: "18px 18px 18px 6px", background: "var(--raise)" }}><span className="dots" aria-label="Copilot is thinking"><span /><span /><span /></span></div>}
        <div ref={endRef} />
      </div>

      <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 10, padding: compact ? "14px 16px 16px" : 0, borderTop: compact ? "1px solid var(--line-soft)" : "none" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {chips.slice(0, 3).map((c) => (
            <button key={c} className="tab" style={{ minHeight: 34, fontSize: 12, padding: "0 12px", fontWeight: 500, color: "#d4d4d8", background: "transparent", borderColor: "#27272a" }}
              onClick={() => { const m = markets.find((x) => x.title === c); if (m) { setSelected(m.id); } else send(c); }}>
              {c}
            </button>
          ))}
        </div>

        {open && (
          <div role="listbox" aria-label="Choose a market" className="fade-up" style={{ position: "absolute", left: compact ? 12 : 0, right: compact ? 12 : 0, bottom: "calc(100% + 8px)", maxHeight: 340, overflowY: "auto", padding: 8, borderRadius: 20, background: "#18181b", border: "1px solid #2e2e33", boxShadow: "0 20px 50px -20px rgba(0,0,0,.9)", zIndex: 5, display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="eyebrow" style={{ padding: "8px 10px 6px" }}>Choose a market</span>
            {markets.filter((m) => !m.resolved).map((m) => (
              <button key={m.id} role="option" aria-selected={m.id === selected} onClick={() => { setSelected(m.id); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", minHeight: 50, padding: "6px 10px", border: 0, borderRadius: 14, cursor: "pointer", color: "var(--text)", background: m.id === selected ? "#27272a" : "transparent", textAlign: "left" }}>
                <span aria-hidden="true" style={{ flex: "none", width: 34, height: 34, borderRadius: 999, background: "var(--line)", display: "grid", placeItems: "center", fontFamily: "var(--display)", fontWeight: 700, fontSize: 10, color: "#d4d4d8" }}>{m.icon}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.35 }}>{m.title}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--yes-text)" }}>{m.yes}%</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: compact ? 0 : 12, borderRadius: 24, background: compact ? "transparent" : "var(--surface)", border: compact ? "none" : "1px solid var(--line)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button aria-expanded={open} onClick={() => setOpen((o) => !o)} className="btn"
              style={{ flex: 1, minWidth: 0, minHeight: 36, justifyContent: "flex-start", padding: "0 14px", fontSize: 13, ...(sel ? { background: "rgba(198,242,78,.1)", borderColor: "rgba(198,242,78,.35)", color: "#e4e4e7" } : { background: "var(--inset)", borderColor: "#27272a", color: "var(--muted)" }) }}>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sel ? sel.title : "Choose a market"}</span>
              <span aria-hidden="true" style={{ marginLeft: "auto", transition: "transform .2s", transform: `rotate(${open ? 180 : 0}deg)` }}>⌃</span>
            </button>
            {sel && !marketId && (
              <button aria-label="Clear market" onClick={() => setSelected(undefined)} className="btn" style={{ width: 36, minHeight: 36, padding: 0, color: "var(--muted)", background: "transparent" }}>✕</button>
            )}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(input); }} style={{ display: "flex", gap: 8 }}>
            <label style={{ flex: 1 }}>
              <span className="sr-only">Ask the copilot</span>
              <input className="input" placeholder="Ask AI Copilot…" value={input} onChange={(e) => setInput(e.target.value)} maxLength={2000} />
            </label>
            <button type="submit" aria-label="Send" className="btn btn-lime" disabled={busy || !input.trim()} style={{ width: 50, height: 50, padding: 0, borderRadius: 14 }}>↑</button>
          </form>
        </div>
        <span style={{ fontSize: 12, color: "var(--faint)", textAlign: "center" }}>My picks are saved before the game, so you can check them later. Paper money only.</span>
      </div>
    </div>
  );
}

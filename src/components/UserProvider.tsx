"use client";
import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

interface UserCtx {
  userId: string | null;
  address: string | null;
  connect: (address: string) => void;
  disconnect: () => void;
}

const Ctx = createContext<UserCtx>({ userId: null, address: null, connect: () => {}, disconnect: () => {} });
const EVT = "previs:user";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, v: string | null) {
  try { if (v) localStorage.setItem(key, v); else localStorage.removeItem(key); } catch {}
  window.dispatchEvent(new Event(EVT));
}

function guestId(): string {
  let g = read("previs.guest");
  if (!g) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    g = "guest-";
    for (let i = 0; i < 10; i++) g += chars[Math.floor(Math.random() * chars.length)];
    try { localStorage.setItem("previs.guest", g); } catch {}
  }
  return g;
}

function subscribe(cb: () => void) {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener("storage", cb); };
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const guest = useSyncExternalStore(subscribe, guestId, () => null);
  const address = useSyncExternalStore(subscribe, () => read("previs.address"), () => null);

  const connect = useCallback((a: string) => write("previs.address", a.toLowerCase()), []);
  const disconnect = useCallback(() => write("previs.address", null), []);

  return <Ctx.Provider value={{ userId: address ?? guest, address, connect, disconnect }}>{children}</Ctx.Provider>;
}

export const useUser = () => useContext(Ctx);

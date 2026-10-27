// User ids are either a Sui address (connected wallet) or a guest id
// generated in the browser ("guest-xxxxxxxx").
export function userIdFrom(raw: unknown): string | null {
  const s = String(raw ?? "").trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s.toLowerCase();
  if (/^guest-[a-z0-9]{6,24}$/.test(s)) return s;
  return null;
}

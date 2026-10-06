// Signed ops session cookie. Signed, not encrypted: it holds a name and an expiry, nothing secret.
// The signing key is OPS_PASSWORD, which has to exist anyway. Rotating it signs everyone out.
// Web Crypto on purpose: the cookie is read on the edge (proxy) and on node (server actions).

export const SESSION_COOKIE = "ops_session";
export const SESSION_HOURS = 12;

export interface OpsSession {
  name: string;
  exp: number; // epoch ms
}

const enc = new TextEncoder();

function secret(): string {
  const s = process.env.OPS_PASSWORD;
  if (!s) throw new Error("OPS_PASSWORD is not set");
  return s;
}

async function hmacKey() {
  return crypto.subtle.importKey("raw", enc.encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + pad);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function signSession(session: OpsSession): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(session)));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<OpsSession | null> {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const session = JSON.parse(new TextDecoder().decode(unb64url(body))) as OpsSession;
    if (typeof session.name !== "string" || typeof session.exp !== "number") return null;
    if (session.exp < Date.now()) return null;
    return session;
  } catch {
    return null;
  }
}

export function freshExpiry(): number {
  return Date.now() + SESSION_HOURS * 60 * 60 * 1000;
}

// Constant time compare for the password itself.
export async function passwordMatches(typed: string): Promise<boolean> {
  const a = enc.encode(typed);
  const b = enc.encode(secret());
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

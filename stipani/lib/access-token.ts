// Server-only: dohvat valjanog Google access tokena iz šifriranog Auth.js JWT-a.
// Token nikad ne napušta server.
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export interface SessionInfo {
  email: string;
  name: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
}

export async function readSession(req: NextRequest): Promise<SessionInfo | null> {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
  const token = await getToken({ req, secret, secureCookie: proto === "https" });
  if (!token?.email) return null;
  return {
    email: token.email,
    name: token.name ?? null,
    accessToken: token.accessToken ?? null,
    refreshToken: token.refreshToken ?? null,
    expiresAt: token.expiresAt ?? null,
  };
}

const cache = new Map<string, { token: string; expiresAt: number }>();

/** Vraća važeći access token ili null (→ korisnik se mora ponovno prijaviti). */
export async function getAccessToken(s: SessionInfo): Promise<string | null> {
  const nowSec = Math.floor(Date.now() / 1000);
  if (s.accessToken && s.expiresAt && s.expiresAt - 60 > nowSec) return s.accessToken;

  const cached = cache.get(s.email);
  if (cached && cached.expiresAt - 60 > nowSec) return cached.token;

  if (!s.refreshToken) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID ?? "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        grant_type: "refresh_token",
        refresh_token: s.refreshToken,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cache.set(s.email, { token: data.access_token, expiresAt: nowSec + (data.expires_in ?? 3600) });
    return data.access_token;
  } catch {
    return null;
  }
}

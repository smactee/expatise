// lib/authClient/web.ts
import type { AuthClient, SessionRes } from "./types";

const GUEST: SessionRes = { ok: false, authed: false, method: "guest", email: null, provider: null };

export const webAuthClient: AuthClient = {
  async getSession() {
    try {
      const res = await fetch("/api/session", {
        cache: "no-store",
        credentials: "include",
      });
      if (!res.ok) return GUEST;
      return (await res.json()) as SessionRes;
    } catch {
      return GUEST;
    }
  },
};

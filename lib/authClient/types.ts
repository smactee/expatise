// lib/authClient/types.ts
export type SessionOk = {
  ok: true;
  authed: true;
  method: "email" | "social";
  email: string | null;
  provider: string | null;
};

export type SessionNo = {
  ok: false;
  authed: false;
  method: "guest";
  email: null;
  provider: null;
};

export type SessionRes = SessionOk | SessionNo;

export type AuthClient = {
  getSession: () => Promise<SessionRes>;
  // keep surface area small for now — we’ll add native later
};

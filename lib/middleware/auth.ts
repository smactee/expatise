// lib/middleware/auth.ts
import type { NextRequest } from "next/server";

// No hard redirects. Guest UX is handled in the UI (modal/blur overlays).
export function authMiddleware(_req: NextRequest) {
  return null;
}

export function applyAuthGate(req: NextRequest) {
  return authMiddleware(req);
}

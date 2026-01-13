// lib/flags/server.ts
import "server-only";
import { PUBLIC_FLAGS } from "./public";

function readBool(name: string, fallback: boolean) {
  const v = process.env[name];
  if (v == null) return fallback;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(s)) return true;
  if (["0", "false", "no", "off"].includes(s)) return false;
  return fallback;
}

export const SERVER_FLAGS = {
  ...PUBLIC_FLAGS,
  enableWeChatAuth: readBool("ENABLE_WECHAT_AUTH", false),
} as const;

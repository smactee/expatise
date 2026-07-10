// lib/flags/server.ts
import "server-only";
import { PUBLIC_FLAGS } from "./public";

export const SERVER_FLAGS = {
  ...PUBLIC_FLAGS,
} as const;

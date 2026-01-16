// lib/authClient/index.ts
import { webAuthClient } from "./web";
export const authClient = webAuthClient;

// later:
// if (typeof window !== "undefined" && (window as any).Capacitor) use nativeAuthClient

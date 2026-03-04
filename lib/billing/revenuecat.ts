"use client";

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

function getApiKeyForPlatform() {
  const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"
  if (platform === "ios") return process.env.NEXT_PUBLIC_REVENUECAT_IOS_KEY ?? "";
  if (platform === "android") return process.env.NEXT_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
  return "";
}

/**
 * Ensures Purchases is configured before any SDK call.
 * If a real userKey is provided, it will attach purchases to that user (via logIn).
 */
export async function ensureRevenueCat(userKey?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const apiKey = getApiKeyForPlatform();
  if (!apiKey) {
    console.warn("[RevenueCat] Missing platform API key.");
    return false;
  }

  // 1) Configure if not configured yet
  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    const level =
      process.env.NODE_ENV === "development" ? LOG_LEVEL.DEBUG : LOG_LEVEL.INFO;
    await Purchases.setLogLevel({ level });

    // IMPORTANT: don't attach "guest" as an appUserID
    const appUserID = userKey && userKey !== "guest" ? userKey : undefined;

    await Purchases.configure({
      apiKey,
      ...(appUserID ? { appUserID } : {}),
    });

    return true;
  }

  // 2) If configured and we now have a real userKey, link/transfer to it
  if (userKey && userKey !== "guest") {
    const current = await Purchases.getAppUserID();
    const currentId =
      typeof current === "string" ? current : (current as any)?.appUserID;

    if (currentId && currentId !== userKey) {
      await Purchases.logIn({ appUserID: userKey });
    }
  }

  return true;
}
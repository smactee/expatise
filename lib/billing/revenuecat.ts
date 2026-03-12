"use client";

import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

// Dev toggle for RevenueCat Test Store.
// IMPORTANT: Test Store is automatically disabled in production builds.
const USE_TEST_STORE =
  process.env.NODE_ENV !== "production" &&
  process.env.NEXT_PUBLIC_RC_USE_TEST_STORE === "1";

function getProductionApiKeyForPlatform() {
  const platform = Capacitor.getPlatform(); // "ios" | "android" | "web"

  if (platform === "ios") {
    return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
  }

  if (platform === "android") {
    return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID ?? "";
  }

  return "";
}

function getRevenueCatApiKey() {
  if (USE_TEST_STORE) {
    return process.env.NEXT_PUBLIC_REVENUECAT_API_KEY_TEST ?? "";
  }

  return getProductionApiKeyForPlatform();
}

/**
 * Ensures Purchases is configured before any SDK call.
 * If a real userKey is provided, it will attach purchases to that user (via logIn).
 */
export async function ensureRevenueCat(userKey?: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;

  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    const expected = USE_TEST_STORE
      ? "NEXT_PUBLIC_REVENUECAT_API_KEY_TEST"
      : "NEXT_PUBLIC_REVENUECAT_API_KEY_ANDROID (or NEXT_PUBLIC_REVENUECAT_API_KEY_IOS)";

    console.warn(`[RevenueCat] Missing API key. Expected: ${expected}.`);
    return false;
  }

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

  if (userKey && userKey !== "guest") {
    const current = await Purchases.getAppUserID();

    const currentId = (() => {
      if (typeof current === "string") return current;

      if (
        typeof current === "object" &&
        current !== null &&
        "appUserID" in current
      ) {
        const appUserID = (current as { appUserID?: unknown }).appUserID;
        return typeof appUserID === "string" ? appUserID : "";
      }

      return "";
    })();

    if (currentId && currentId !== userKey) {
      await Purchases.logIn({ appUserID: userKey });
    }
  }

  return true;
}
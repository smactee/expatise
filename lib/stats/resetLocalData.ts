// lib/resetLocalData.ts
import { AUTH_COOKIE } from "@/lib/auth";
import { ONBOARDING_COOKIE } from "@/lib/middleware/paths";

const APP_PREFIXES = ["expatise", "__expatise_", "sb-expatise-auth"];
const EXTRA_KEYS = ["topicQuiz:v1", "THEME_STORAGE_KEY"];

function clearCookie(name: string) {
  if (typeof document === "undefined" || !name) return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

function collectKeys(storage: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

function isOwnedKey(key: string) {
  return APP_PREFIXES.some((prefix) => key.startsWith(prefix)) || EXTRA_KEYS.includes(key);
}

export async function resetAllLocalData(opts?: { includeCaches?: boolean }) {
  if (typeof window === "undefined") return;

  // localStorage
  for (const k of collectKeys(window.localStorage)) {
    if (isOwnedKey(k)) {
      window.localStorage.removeItem(k);
    }
  }

  // sessionStorage
  for (const k of collectKeys(window.sessionStorage)) {
    if (isOwnedKey(k)) {
      window.sessionStorage.removeItem(k);
    }
  }

  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { keys } = await Preferences.keys();

    await Promise.all(
      (keys ?? [])
        .filter((key) => isOwnedKey(key))
        .map((key) => Preferences.remove({ key }))
    );
  } catch {
    // ignore when Preferences is unavailable
  }

  clearCookie(ONBOARDING_COOKIE);
  clearCookie(AUTH_COOKIE);

  // Optional: clear Cache Storage (PWA / SW caches)
  if (opts?.includeCaches && "caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}

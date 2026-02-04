// lib/resetLocalData.ts

const APP_PREFIXES = ["expatise:"]; // everything your app owns
const EXTRA_KEYS = ["topicQuiz:v1"]; // legacy key your Stats page used

function collectKeys(storage: Storage) {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i);
    if (k) keys.push(k);
  }
  return keys;
}

export async function resetAllLocalData(opts?: { includeCaches?: boolean }) {
  if (typeof window === "undefined") return;

  // localStorage
  for (const k of collectKeys(window.localStorage)) {
    if (APP_PREFIXES.some((p) => k.startsWith(p)) || EXTRA_KEYS.includes(k)) {
      window.localStorage.removeItem(k);
    }
  }

  // sessionStorage (if you ever used it)
  for (const k of collectKeys(window.sessionStorage)) {
    if (APP_PREFIXES.some((p) => k.startsWith(p))) {
      window.sessionStorage.removeItem(k);
    }
  }

  // Optional: clear Cache Storage (PWA / SW caches)
  if (opts?.includeCaches && "caches" in window) {
    const names = await caches.keys();
    await Promise.all(names.map((n) => caches.delete(n)));
  }
}

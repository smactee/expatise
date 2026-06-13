// lib/kakao/sdk.ts
//
// THE single, guarded loader for the Kakao Maps JavaScript SDK. The JS key is
// read ONLY from NEXT_PUBLIC_KAKAO_JS_KEY here — this is the one and only
// reference to the key in the codebase, never hardcoded. Both the map view and
// the rate-limited Local-API calls share this one loader (one <script>, one
// singleton), and it loads the `services` library so geocoding / keyword search
// work from the same JS key (no REST key in the client).

const SDK_SCRIPT_ID = 'kakao-maps-sdk';
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export class KakaoKeyMissingError extends Error {
  constructor() {
    super('Missing NEXT_PUBLIC_KAKAO_JS_KEY');
    this.name = 'KakaoKeyMissingError';
  }
}

export function isKakaoKeyConfigured(): boolean {
  return Boolean(KAKAO_JS_KEY && KAKAO_JS_KEY.trim().length > 0);
}

// Singleton: the SDK <script> is injected at most once and
// window.kakao.maps.load() is awaited exactly once, regardless of how many map
// instances mount or how often fast-refresh re-runs effects.
let sdkPromise: Promise<void> | null = null;

export function loadKakaoSdk(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Kakao SDK can only load in the browser'));
  }
  if (window.kakao?.maps) return Promise.resolve();
  if (sdkPromise) return sdkPromise;

  // Fail LOUDLY rather than injecting sdk.js with a blank appkey, which 401s
  // silently and leaves the map mysteriously empty.
  if (!isKakaoKeyConfigured()) {
    console.error(
      '[Kakao] Missing NEXT_PUBLIC_KAKAO_JS_KEY — map and location features are disabled. ' +
        'Set it in .env.local (dev) and the Vercel project env (build).',
    );
    return Promise.reject(new KakaoKeyMissingError());
  }

  sdkPromise = new Promise<void>((resolve, reject) => {
    // autoload=false → we control init: call kakao.maps.load() once the script
    // is parsed, and only then is the SDK (and services library) usable.
    const onScriptLoad = () => {
      if (!window.kakao?.maps) {
        reject(new Error('Kakao SDK loaded but window.kakao.maps is missing'));
        return;
      }
      window.kakao.maps.load(() => resolve());
    };
    const onScriptError = () => {
      sdkPromise = null; // allow a later retry (e.g. network recovered)
      reject(new Error('Kakao Maps SDK failed to load'));
    };

    const existing = document.getElementById(SDK_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.kakao?.maps) onScriptLoad();
      else {
        existing.addEventListener('load', onScriptLoad, { once: true });
        existing.addEventListener('error', onScriptError, { once: true });
      }
      return;
    }

    const script = document.createElement('script');
    script.id = SDK_SCRIPT_ID;
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;
    script.addEventListener('load', onScriptLoad, { once: true });
    script.addEventListener('error', onScriptError, { once: true });
    document.head.appendChild(script);
  });
  return sdkPromise;
}

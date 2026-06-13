// lib/kakao/limitedCall.ts
//
// THE single choke point every Kakao Local API call must route through. Before
// each call it atomically counts the call in the central Supabase counter; if
// today's KST count exceeds the category cap, it does NOT hit Kakao and returns
// a typed { limited: true } so the UI degrades gracefully ("location lookup
// unavailable — enter manually") instead of silently blowing the daily quota.
//
// Geocoding/search go through the JS SDK `services` library with the JS key —
// no REST API key is ever introduced into the client (a static export has
// nowhere safe to hold a secret key).

import { loadKakaoSdk } from '@/lib/kakao/sdk';
import { DAILY_CAP, incrementKakaoUsage, type KakaoUsageCategory } from '@/lib/kakao/usage';

export type LimitedResult<T> =
  | { limited: false; data: T }
  | { limited: true; count: number | null };

/**
 * Count one call against `category`, then either run it or short-circuit.
 *
 * Fail-open policy: if the central counter is unreachable (returns null), the
 * call still runs — this is a best-effort overage guard, not a hard security
 * boundary, and we'd rather serve the user than hard-fail on a transient
 * Supabase blip. Over the cap (a real, counted signal), we block.
 */
export async function limitedKakaoCall<T>(
  category: KakaoUsageCategory,
  run: () => Promise<T>,
): Promise<LimitedResult<T>> {
  const count = await incrementKakaoUsage(category);
  if (count != null && count > DAILY_CAP[category]) {
    console.warn(`[Kakao] ${category} daily cap reached (${count}/${DAILY_CAP[category]}); skipping call.`);
    return { limited: true, count };
  }
  const data = await run();
  return { limited: false, data };
}

export type GeoPoint = { lat: number; lng: number; label: string };

function requireServices(): KakaoServicesNamespace {
  const services = window.kakao?.maps?.services;
  if (!services) throw new Error('Kakao services library not available');
  return services;
}

/** Address → coordinates (Local API). Routed through the daily cap. */
export async function geocodeAddress(query: string): Promise<LimitedResult<GeoPoint[]>> {
  return limitedKakaoCall('local', async () => {
    await loadKakaoSdk();
    const services = requireServices();
    const { Status } = window.kakao!.maps.services;
    return new Promise<GeoPoint[]>((resolve, reject) => {
      new services.Geocoder().addressSearch(query, (result, status) => {
        if (status === Status.OK) {
          resolve(result.map((r) => ({ lat: Number(r.y), lng: Number(r.x), label: r.address_name })));
        } else if (status === Status.ZERO_RESULT) {
          resolve([]);
        } else {
          reject(new Error(`Kakao addressSearch failed: ${status}`));
        }
      });
    });
  });
}

/** Coordinates → Korean address (Local API reverse geocode). Routed through the daily cap. */
export async function reverseGeocode(lat: number, lng: number): Promise<LimitedResult<GeoPoint>> {
  return limitedKakaoCall('local', async () => {
    await loadKakaoSdk();
    const services = requireServices();
    const { Status } = window.kakao!.maps.services;
    return new Promise<GeoPoint>((resolve, reject) => {
      // Kakao takes (lng, lat) order here.
      new services.Geocoder().coord2Address(lng, lat, (result, status) => {
        if (status === Status.OK) {
          const top = result[0];
          const label = top?.road_address?.address_name || top?.address?.address_name || '';
          resolve({ lat, lng, label });
        } else if (status === Status.ZERO_RESULT) {
          resolve({ lat, lng, label: '' });
        } else {
          reject(new Error(`Kakao coord2Address failed: ${status}`));
        }
      });
    });
  });
}

/** Keyword place search (Local API). Routed through the daily cap. */
export async function searchPlaces(keyword: string): Promise<LimitedResult<GeoPoint[]>> {
  return limitedKakaoCall('local', async () => {
    await loadKakaoSdk();
    const services = requireServices();
    const { Status } = window.kakao!.maps.services;
    return new Promise<GeoPoint[]>((resolve, reject) => {
      new services.Places().keywordSearch(keyword, (data, status) => {
        if (status === Status.OK) {
          resolve(data.map((d) => ({ lat: Number(d.y), lng: Number(d.x), label: d.place_name })));
        } else if (status === Status.ZERO_RESULT) {
          resolve([]);
        } else {
          reject(new Error(`Kakao keywordSearch failed: ${status}`));
        }
      });
    });
  });
}

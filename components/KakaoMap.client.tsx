'use client';

import { useEffect, useRef, useState } from 'react';

import { loadKakaoSdk } from '@/lib/kakao/sdk';
import { monitorMapUsage } from '@/lib/kakao/usage';

import styles from './KakaoMap.module.css';

const SEOUL: LatLngLiteral = { lat: 37.5665, lng: 126.978 };
const DEFAULT_LEVEL = 8; // Kakao zoom: lower = closer in

export type LatLngLiteral = { lat: number; lng: number };
export type MapMarker = { lat: number; lng: number; title: string };

export type KakaoMapProps = {
  center?: LatLngLiteral;
  /** Kakao zoom level (1 = closest, larger = further out). Default 8. */
  level?: number;
  markers?: MapMarker[];
  /** Extra class on the wrapper (e.g. to override the default height). */
  className?: string;
  ariaLabel?: string;
  /** Fires with the tapped coordinate so a parent can re-pin (e.g. precise residence). */
  onPick?: (coords: LatLngLiteral) => void;
};

type LoadState = 'loading' | 'ready' | 'error';

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
  );
}

/**
 * Client-only Kakao Maps view. All browser/SDK access is inside effects, so it
 * is safe under Next's static export (`output: 'export'`) — effects never run
 * during the build-time prerender. For a route that must not even include it in
 * the prerendered HTML, import it via `next/dynamic(..., { ssr: false })` from a
 * client component (see usage note in the PR description).
 */
export default function KakaoMap({
  center = SEOUL,
  level = DEFAULT_LEVEL,
  markers = [],
  className,
  ariaLabel = 'Map',
  onPick,
}: KakaoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<KakaoMapInstance | null>(null);
  // Latest onPick without re-running the (mount-once) map-init effect.
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  // Captured once: the init effect should run on mount only; live prop changes
  // are handled by the dedicated effects below (avoids recreating the map).
  const initialRef = useRef({ center, level });
  const [state, setState] = useState<LoadState>('loading');

  // 1) Load SDK + create the map (once).
  useEffect(() => {
    let cancelled = false;
    setState('loading');

    loadKakaoSdk()
      .then(() => {
        if (cancelled || !containerRef.current || !window.kakao?.maps) return;
        const { maps } = window.kakao;
        const { center: c, level: l } = initialRef.current;
        const map = new maps.Map(containerRef.current, {
          center: new maps.LatLng(c.lat, c.lng),
          level: l,
        });
        // If the container was hidden/zero-sized at creation (tabs, modals),
        // relayout once it is on screen.
        map.relayout();
        map.setCenter(new maps.LatLng(c.lat, c.lng));
        mapRef.current = map;
        // Tap-to-repin: report the clicked coordinate to the parent.
        maps.event.addListener(map, 'click', (event) => {
          const ll = event?.latLng;
          if (ll && onPickRef.current) onPickRef.current({ lat: ll.getLat(), lng: ll.getLng() });
        });
        setState('ready');
        // Soft, non-blocking monitor of the Map-display daily quota. Never
        // awaited and never throws — map render is unaffected if it fails.
        monitorMapUsage();
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[KakaoMap]', err);
        setState('error');
      });

    return () => {
      cancelled = true;
      mapRef.current = null;
    };
  }, []);

  // 2) React to center/level changes without rebuilding the map.
  useEffect(() => {
    if (state !== 'ready' || !mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;
    mapRef.current.setCenter(new maps.LatLng(center.lat, center.lng));
    mapRef.current.setLevel(level);
  }, [center.lat, center.lng, level, state]);

  // 3) Render markers + clickable info windows; rebuilt when the set changes.
  // markersKey keeps this stable when the caller passes an equal inline array.
  const markersKey = JSON.stringify(markers);
  useEffect(() => {
    if (state !== 'ready' || !mapRef.current || !window.kakao?.maps) return;
    const { maps } = window.kakao;
    const map = mapRef.current;

    const created = markers.map((m) => {
      const position = new maps.LatLng(m.lat, m.lng);
      const marker = new maps.Marker({ position, title: m.title, map });
      const info = new maps.InfoWindow({
        content: `<div class="${styles.infoWindow}"><span class="${styles.infoTitle}">${escapeHtml(m.title)}</span></div>`,
        removable: true,
      });
      maps.event.addListener(marker, 'click', () => info.open(map, marker));
      return { marker, info };
    });

    return () => {
      created.forEach(({ marker, info }) => {
        info.close();
        marker.setMap(null);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markersKey, state]);

  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <div ref={containerRef} className={styles.map} role="application" aria-label={ariaLabel} />
      {state === 'loading' && <div className={styles.loading}>Loading map…</div>}
      {state === 'error' && (
        <div className={styles.fallback} role="alert">
          <span>Map couldn’t be loaded.</span>
          <span className={styles.fallbackHint}>Check your connection and try again.</span>
        </div>
      )}
    </div>
  );
}

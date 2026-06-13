'use client';

// TEMPORARY dev-only verification route — intentionally NOT linked in nav.
// Renders <Globe /> full-screen, logs onCountrySelect, and exposes buttons that
// drive the imperative handle (flyTo + selectCountryByIso). Delete the whole
// app/dev/globe-test/ folder when done.

import { useRef, useState } from 'react';

import Globe, { type CountrySelection, type GlobeHandle } from '@/components/Globe.client';

export default function GlobeTestPage() {
  const globeRef = useRef<GlobeHandle>(null);
  const [last, setLast] = useState<CountrySelection | null>(null);

  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <Globe
        ref={globeRef}
        onCountrySelect={(c) => {
          // eslint-disable-next-line no-console
          console.log('[globe-test] onCountrySelect', c);
          setLast(c);
        }}
      />

      <div
        style={{
          position: 'fixed',
          left: 12,
          bottom: 'max(12px, env(safe-area-inset-bottom))',
          zIndex: 10,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          maxWidth: 'calc(100vw - 24px)',
        }}
      >
        <button type="button" onClick={() => globeRef.current?.flyTo({ lat: 37.5665, lng: 126.978, altitude: 0.6 })}>
          flyTo Seoul
        </button>
        <button type="button" onClick={() => globeRef.current?.flyTo({ lat: 1.3521, lng: 103.8198, altitude: 0.4 })}>
          flyTo Singapore
        </button>
        <button type="button" onClick={() => globeRef.current?.selectCountryByIso('KR')}>
          selectCountryByIso(&apos;KR&apos;)
        </button>
        <span
          style={{
            color: '#eaf1fb',
            background: 'rgba(10,17,33,0.7)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
          }}
        >
          {last ? `${last.name} (${last.iso}) ${last.lat.toFixed(2)},${last.lng.toFixed(2)}` : 'tap a country'}
        </span>
      </div>
    </main>
  );
}

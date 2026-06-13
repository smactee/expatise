'use client';

// TEMPORARY dev-only verification route — intentionally NOT linked in nav.
// Mounts KakaoMap on Seoul with one marker so you can confirm tiles render
// after registering the domains in the Kakao console. Safe to delete the whole
// app/dev/kakao-test/ folder when done.

import KakaoMap from '@/components/KakaoMap.client';

export default function KakaoTestPage() {
  return (
    <main style={{ padding: 16, maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ fontSize: 18, marginBottom: 4 }}>Kakao Map test (dev only)</h1>
      <p style={{ fontSize: 13, opacity: 0.7, marginBottom: 12 }}>
        Centered on Seoul with one marker. If you see the fallback instead of tiles, register this
        origin under the JavaScript key in the Kakao console. Delete <code>app/dev/kakao-test/</code>{' '}
        when finished.
      </p>
      <KakaoMap
        center={{ lat: 37.5665, lng: 126.978 }}
        level={6}
        markers={[{ lat: 37.5665, lng: 126.978, title: 'Seoul City Hall' }]}
        ariaLabel="Kakao map test"
      />
    </main>
  );
}

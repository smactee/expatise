'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

export default function NativeInsets() {
  useEffect(() => {
    // Only run inside Capacitor native apps
    if (!Capacitor.isNativePlatform()) return;

    (async () => {
      try {
        const info = await StatusBar.getInfo();
        // 'height' exists in practice, but may not be typed
        const height = (info as any)?.height;

        // Fallback: if height is missing, use 0 (you can use 24 if you prefer)
        const px = Number.isFinite(height) ? `${height}px` : '0px';

        document.documentElement.style.setProperty('--statusbar-h', px);
      } catch {
        // Don't break the app if plugin isn't available
        document.documentElement.style.setProperty('--statusbar-h', '0px');
      }
    })();
  }, []);

  return null;
}
// capacitor.config.ts
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.expatise.app',     // ✅ final package identity for Play Store
  appName: 'Expatise',
  webDir: 'out',                // ✅ correct for Next export
  
};

export default config;
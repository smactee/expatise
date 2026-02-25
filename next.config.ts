import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  output: 'export',
  // other config options here...
  images: {
    unoptimized: true,
    remotePatterns: [
    {
      protocol: 'https',
      hostname: 'YOURPROJECT.supabase.co',
      pathname: '/storage/v1/object/**',
    },
  ],
  },
};
module.exports = nextConfig;

export default nextConfig;

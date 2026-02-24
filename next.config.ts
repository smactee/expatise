import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: true,
  output: 'export',
  // other config options here...
};
module.exports = nextConfig;

export default nextConfig;

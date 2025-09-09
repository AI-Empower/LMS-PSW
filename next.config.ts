// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Produce a self-contained build under .next/standalone
   * so the runtime image stays small and only includes what’s needed.
   */
  output: 'standalone',

  /**
   * Optional but recommended:
   * - Strict mode helps catch issues during development.
   */
  reactStrictMode: true,

  /**
   * If you serve images from external domains, whitelist them here.
   * Remove or adjust as needed.
   */
  images: {
    remotePatterns: [
      // { protocol: 'https', hostname: 'your.cdn.com' },
    ],
  },
  eslint: {
    // ✅ Disable ESLint checks during `next build`
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;


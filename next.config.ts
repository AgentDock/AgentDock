import type { NextConfig } from "next";

/**
 * AgentDock Next.js Configuration
 * Follows first principles:
 * 1. Simplicity - Keep it minimal
 * 2. Clarity - Clear purpose for each option
 * 3. Extensibility - Ready for Pro features
 */
const nextConfig: NextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Enable typed routes - core feature for AgentDock
  experimental: {
    typedRoutes: true,
  },

  // Basic security - more in Pro version
  poweredByHeader: false,
};

export default nextConfig;

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

  // Add build logging through webpack
  webpack: (config, { buildId, dev, isServer }) => {
    // Log build information
    console.log('Next.js Build Info:', { buildId, dev, isServer });
    
    // This is a good place to check route compilation
    if (isServer) {
      console.log('Compiling server routes...');
    }
    
    return config;
  }
};

export default nextConfig;

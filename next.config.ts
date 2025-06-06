import path from 'path';
import type { NextConfig } from 'next';

/**
 * AgentDock Next.js Configuration
 * Follows first principles:
 * 1. Simplicity - Keep it minimal
 * 2. Clarity - Clear purpose for each option
 * 3. Extensibility - Ready for Pro features
 */
// This is a special type to extend Next.js config with custom properties
type CustomNextConfig = NextConfig & {
  experimental?: {
    typedRoutes?: boolean;
  };
  outputFileTracingIncludes?: Record<string, string[]>;
  outputFileTracingRoot?: string;
};

// Create a base config with standard options
const nextConfig: CustomNextConfig = {
  // Enable React strict mode for better development
  reactStrictMode: true,

  // Basic security - more in Pro version
  poweredByHeader: false,

  // Output configuration
  output: 'standalone',

  // Disable image optimization in dev to reduce warnings
  images: {
    unoptimized: process.env.NODE_ENV === 'development'
  },

  // Experimental features
  experimental: {
    typedRoutes: true
  },

  // File tracing configuration (at root level as required by Next.js)
  outputFileTracingIncludes: {
    '/app/docs/**/*': ['./docs/**/*']
  },
  outputFileTracingRoot: path.join(__dirname)
};

export default nextConfig;

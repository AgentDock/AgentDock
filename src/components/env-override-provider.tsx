'use client';

import React, { useEffect } from 'react';

interface EnvOverrideProviderProps {
  children: React.ReactNode;
}

/**
 * Sets up environment overrides for message history settings.
 * This allows for global configuration regardless of template settings.
 * 
 * Security precedence hierarchy (highest to lowest):
 * 1. Environment variables (.env file) - controlled by server admin
 * 2. URL parameters - for temporary testing only
 * 
 * Available overrides:
 * - ENV_HISTORY_POLICY: 'none' | 'lastN' | 'all'
 * - ENV_HISTORY_LENGTH: number
 * - URL parameter byokMode: 'true' | 'false' (controls Bring Your Own Keys mode)
 */
export function EnvOverrideProvider({ children }: EnvOverrideProviderProps) {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      console.debug('[EnvOverride] Setting up environment overrides...');
      
      // Order of precedence for security:
      // 1. Environment variables (highest security - server controlled)
      // 2. URL parameters (lowest security - user controlled)
      
      // First apply environment variables if available (highest precedence)
      if (process.env.NEXT_PUBLIC_DEFAULT_HISTORY_POLICY) {
        const envPolicy = process.env.NEXT_PUBLIC_DEFAULT_HISTORY_POLICY;
        if (['none', 'lastN', 'all'].includes(envPolicy)) {
          (window as any).ENV_HISTORY_POLICY = envPolicy;
          console.info(`[EnvOverride] Set history policy from environment: ${envPolicy}`);
        }
      }
      
      if (process.env.NEXT_PUBLIC_DEFAULT_HISTORY_LENGTH) {
        const envLength = parseInt(process.env.NEXT_PUBLIC_DEFAULT_HISTORY_LENGTH, 10);
        if (!isNaN(envLength) && envLength >= 0) {
          (window as any).ENV_HISTORY_LENGTH = envLength;
          console.info(`[EnvOverride] Set history length from environment: ${envLength}`);
        }
      }
      
      // Only consider URL parameters if they exist
      const url = new URL(window.location.href);
      const hasParams = url.search.length > 1;
      
      if (hasParams) {
        console.debug('[EnvOverride] URL parameters detected:', url.search);
        const params = new URLSearchParams(url.search);
        
        // Apply URL parameters - but only if environment variables aren't set
        const historyPolicy = params.get('historyPolicy');
        if (historyPolicy && ['none', 'lastN', 'all'].includes(historyPolicy) && 
            !(window as any).ENV_HISTORY_POLICY) {
          (window as any).ENV_HISTORY_POLICY = historyPolicy;
          console.info(`[EnvOverride] Set history policy from URL: ${historyPolicy}`);
        }
        
        const historyLength = params.get('historyLength');
        if (historyLength !== null && !(window as any).ENV_HISTORY_LENGTH) {
          const length = parseInt(historyLength, 10);
          if (!isNaN(length) && length >= 0) {
            (window as any).ENV_HISTORY_LENGTH = length;
            console.info(`[EnvOverride] Set history length from URL: ${length}`);
          }
        }
        
        // BYOK mode is always controlled by URL (special case)
        const byokMode = params.get('byokMode');
        if (byokMode === 'true' || byokMode === 'false') {
          localStorage.setItem('byokOnly', byokMode);
          console.info(`[EnvOverride] Set BYOK mode from URL: ${byokMode}`);
        }
      }
      
      // Log final values for debugging
      console.debug('[EnvOverride] Final environment settings:', {
        historyPolicy: (window as any).ENV_HISTORY_POLICY,
        historyLength: (window as any).ENV_HISTORY_LENGTH,
        source: process.env.NEXT_PUBLIC_DEFAULT_HISTORY_LENGTH ? 'environment' : 'URL'
      });
    } catch (error) {
      console.error('[EnvOverride] Failed to set environment overrides:', error);
    }
  }, []);

  return <>{children}</>;
} 
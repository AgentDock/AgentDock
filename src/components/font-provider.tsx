'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';

import { SecureStorage } from 'agentdock-core/storage/secure-storage';

import { GlobalSettings } from '@/app/settings/types';
import { FontFamily, fontOptions, monoFonts } from '@/lib/fonts';

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontSettings, setFontSettings] = useState<{
    primary: FontFamily;
    mono: string;
  }>({
    primary: 'inter',
    mono: 'default'
  });

  // Use refs to prevent unnecessary re-renders
  const initializedRef = useRef(false);
  const isApplyingRef = useRef(false);

  // Memoize the font application function to prevent recreation on each render
  const applyFonts = useCallback((primary: FontFamily, mono: string) => {
    // Skip on server side or if already applying
    if (typeof document === 'undefined' || isApplyingRef.current) return;

    isApplyingRef.current = true;

    try {
      const html = document.documentElement;
      const body = document.body;

      // First remove all font classes from body
      Object.values(fontOptions).forEach((font) => {
        body.classList.remove(font.className);
      });

      // Don't apply mono fonts to body at all
      Object.values(monoFonts).forEach((font) => {
        body.classList.remove(font.className);
      });

      // 1. Apply primary font class to body
      const primaryFont = fontOptions[primary];
      if (primaryFont) {
        body.classList.add(primaryFont.className);
        // Set CSS variables for primary font
        html.style.setProperty('--font-primary', primaryFont.fontFamily);
      }

      // 2. Set the mono font as a CSS variable only
      if (mono !== 'default') {
        const monoFont = monoFonts[mono as keyof typeof monoFonts];
        if (monoFont) {
          // Set CSS variable for monospace font
          html.style.setProperty('--font-mono', monoFont.fontFamily);

          // Add variable class to html for variable fonts
          if (mono === 'geistMono') {
            html.classList.add(GeistMono.variable);
          }
        }
      } else {
        // Use system monospace font if default is selected
        html.style.setProperty(
          '--font-mono',
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        );
      }

      // Always add Geist variables to html for variable font support
      html.classList.add(GeistSans.variable);

      // Store settings without triggering renders
      localStorage.setItem(
        'current-font-settings',
        JSON.stringify({ primary, mono })
      );
    } finally {
      isApplyingRef.current = false;
    }
  }, []);

  // Initial loading of font settings - runs only once
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let isMounted = true;

    // Load font settings from secure storage
    const loadFontSettings = async () => {
      try {
        // First add prevent-transition to avoid flickering
        if (typeof document !== 'undefined') {
          document.documentElement.classList.add('prevent-transition');
        }

        const storage = SecureStorage.getInstance('agentdock');
        const settings = await storage.get<GlobalSettings>('global_settings');

        if (settings?.fonts && isMounted) {
          // Only update state if component is still mounted
          setFontSettings(settings.fonts);

          // Apply fonts immediately when loaded
          requestAnimationFrame(() => {
            applyFonts(settings.fonts.primary, settings.fonts.mono);

            // Remove prevent-transition class after fonts are applied
            setTimeout(() => {
              if (typeof document !== 'undefined') {
                document.documentElement.classList.remove('prevent-transition');
              }
            }, 300);
          });
        } else {
          // Remove prevent-transition if no settings found
          setTimeout(() => {
            if (typeof document !== 'undefined') {
              document.documentElement.classList.remove('prevent-transition');
            }
          }, 300);
        }
      } catch {
        // Remove prevent-transition in case of error
        if (typeof document !== 'undefined') {
          document.documentElement.classList.remove('prevent-transition');
        }
      }
    };

    loadFontSettings();

    // Set up storage event listener for changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'global_settings' && isMounted) {
        loadFontSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      isMounted = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [applyFonts]); // Depend on the memoized function

  // Apply fonts whenever settings change - ensure this doesn't run unnecessarily
  useEffect(() => {
    // Skip the initial render
    if (!initializedRef.current) return;

    const timer = setTimeout(() => {
      applyFonts(fontSettings.primary, fontSettings.mono);
    }, 0);

    return () => clearTimeout(timer);
  }, [fontSettings.primary, fontSettings.mono, applyFonts]);

  // Just render children without wrapper to minimize DOM
  return children;
}

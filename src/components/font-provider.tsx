"use client"

import { useEffect, useState } from "react"
import { GlobalSettings } from "@/app/settings/types"
import { SecureStorage } from "agentdock-core"
import { fontOptions, monoFonts, FontFamily } from "@/lib/fonts"
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontSettings, setFontSettings] = useState<{
    primary: FontFamily
    mono: string
  }>({
    primary: 'inter',
    mono: 'default'
  });

  // Apply the selected fonts
  const applyFonts = (primary: FontFamily, mono: string) => {
    // Get the document element
    if (typeof document === 'undefined') return;
    
    const html = document.documentElement;
    const body = document.body;

    // First remove all font classes from body
    Object.values(fontOptions).forEach(font => {
      body.classList.remove(font.className);
    });
    
    // Don't apply mono fonts to body at all
    Object.values(monoFonts).forEach(font => {
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
      html.style.setProperty('--font-mono', 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace');
    }
    
    // Always add Geist variables to html for variable font support
    html.classList.add(GeistSans.variable);
    
    // Log applied fonts for debugging
    console.log('Applied fonts:', { 
      primary: { 
        name: primaryFont?.name, 
        fontFamily: primaryFont?.fontFamily
      }, 
      mono: mono !== 'default' ? {
        name: monoFonts[mono as keyof typeof monoFonts]?.name,
        fontFamily: monoFonts[mono as keyof typeof monoFonts]?.fontFamily
      } : 'default'
    });
    
    // Store current font settings for debugging
    localStorage.setItem('current-font-settings', JSON.stringify({ primary, mono }));
  };

  useEffect(() => {
    // Load font settings from secure storage
    const loadFontSettings = async () => {
      try {
        const storage = SecureStorage.getInstance('agentdock');
        const settings = await storage.get<GlobalSettings>("global_settings");
        
        if (settings?.fonts) {
          setFontSettings(settings.fonts);
          
          // Apply fonts immediately when loaded
          applyFonts(settings.fonts.primary, settings.fonts.mono);
        }
      } catch (error) {
        console.error("Failed to load font settings:", error);
      }
    };
    
    loadFontSettings();
    
    // Set up storage event listener for changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'global_settings') {
        loadFontSettings();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Apply fonts whenever settings change
  useEffect(() => {
    applyFonts(fontSettings.primary, fontSettings.mono);
  }, [fontSettings]);

  return <>{children}</>;
} 
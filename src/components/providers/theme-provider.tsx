"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { type ThemeProviderProps } from "next-themes/dist/types"

/**
 * PRIMARY THEME PROVIDER - This is the only ThemeProvider that should be used in the application
 * 
 * It wraps the application in the layout-content.tsx file
 */
export function ThemeProvider({
  children,
  ...props
}: {
  children: React.ReactNode
} & ThemeProviderProps) {
  // const [mounted, setMounted] = React.useState(false)
  // const mountingRef = React.useRef(false)

  // Minimal effect to prevent initial transition flash
  React.useEffect(() => {
    // Add the class immediately on mount
    document.documentElement.classList.add('prevent-transition');

    // Schedule removal shortly after the first paint
    // Using requestAnimationFrame ensures it runs after the browser has painted
    // Alternatively, setTimeout(..., 1) could be used.
    const animationFrameId = requestAnimationFrame(() => {
      document.documentElement.classList.remove('prevent-transition');
    });

    // Cleanup function to cancel the removal if the component unmounts quickly
    return () => {
      cancelAnimationFrame(animationFrameId);
      // Optionally, ensure the class is removed on unmount too, though less critical
      // document.documentElement.classList.remove('prevent-transition');
    };
  }, []); // Run only once on mount

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange // Keep this for smoother subsequent changes
      storageKey="agentdock-theme"
      // No forcedTheme needed here
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
} 
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

  // Handle mounting only once to prevent multiple transitions
  // React.useEffect(() => {
  //   if (mountingRef.current) return;
  //   mountingRef.current = true;
    
  //   // First add class to completely disable all transitions
  //   if (typeof document !== 'undefined') {
  //     document.documentElement.classList.add('prevent-transition');
  //   }
    
  //   // Delay mounting state to ensure theme is fully loaded
  //   const timer = setTimeout(() => {
  //     setMounted(true);
      
  //     // Remove transition prevention after theme is stable
  //     if (typeof document !== 'undefined') {
  //       setTimeout(() => {
  //         document.documentElement.classList.remove('prevent-transition');
  //       }, 300);
  //     }
  //   }, 50);
    
  //   return () => clearTimeout(timer);
  // }, []);

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange // Rely on this built-in prop
      storageKey="agentdock-theme"
      // forcedTheme={!mounted ? undefined : undefined} // Remove forced theme based on mount state
      {...props}
    >
      {children}
    </NextThemesProvider>
  );
} 
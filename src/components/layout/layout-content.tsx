'use client';

import { useState, useCallback, useEffect, createContext, useContext, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from "sonner";
import { SiteHeader } from '@/components/layout/site-header';
import { SiteSidebar } from '@/components/layout/site-sidebar';
import { CoreInitializer } from '@/components/core/initializer';
import { FontProvider } from '@/components/font-provider';
import { cn } from '@/lib/utils';

// Create a context to share the collapse state and handlers
interface SidebarContextType {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
  toggleSidebar: () => void;
  expandSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextType>({
  isCollapsed: false,
  setIsCollapsed: () => {},
  toggleSidebar: () => {},
  expandSidebar: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Determine if the sidebar should be collapsed based on pathname
  const shouldBeCollapsed = useMemo(() => {
    return pathname.startsWith('/docs');
  }, [pathname]);
  
  // Set initial collapsed state based on pathname
  const [isCollapsed, setIsCollapsed] = useState(shouldBeCollapsed);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(prev => !prev);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  // Monitor pathname changes and collapse sidebar when on docs pages
  useEffect(() => {
    setIsCollapsed(shouldBeCollapsed);
  }, [shouldBeCollapsed]);

  return (
    <ThemeProvider>
      <FontProvider>
        <CoreInitializer />
        <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed, toggleSidebar, expandSidebar }}>
          <div className="relative min-h-screen bg-background">
            <SiteSidebar isCollapsed={isCollapsed} />
            <div 
              className={cn(
                "flex min-h-screen flex-col transition-all duration-300 ease-in-out",
                isCollapsed ? "md:ml-[70px]" : "md:ml-[240px]"
              )}
            >
              <SiteHeader 
                isCollapsed={isCollapsed} 
                onCollapse={toggleSidebar} 
              />
              <main className="flex-1 p-0 md:p-8 md:py-0 relative">
                {children}
              </main>
            </div>
          </div>
        </SidebarContext.Provider>
        <Toaster richColors />
      </FontProvider>
    </ThemeProvider>
  );
} 
'use client';

import { useState } from 'react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from "sonner";
import { SiteHeader } from '@/components/layout/site-header';
import { SiteSidebar } from '@/components/layout/site-sidebar';
import { CoreInitializer } from '@/components/core/initializer';
import { FontProvider } from '@/components/font-provider';
import { cn } from '@/lib/utils';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem 
      disableTransitionOnChange
    >
      <FontProvider>
        <CoreInitializer />
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
              onCollapse={() => setIsCollapsed(!isCollapsed)} 
            />
            <main className="flex-1 overflow-y-auto p-0 md:p-8 md:py-0 relative">
              {children}
            </main>
          </div>
        </div>
        <Toaster richColors />
      </FontProvider>
    </ThemeProvider>
  );
} 
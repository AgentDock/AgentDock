'use client';

import { useState } from 'react';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from "sonner";
import { SiteHeader } from '@/components/layout/site-header';
import { SiteSidebar } from '@/components/layout/site-sidebar';
import { CoreInitializer } from '@/components/core/initializer';

export function LayoutContent({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <ThemeProvider 
      attribute="class" 
      defaultTheme="system" 
      enableSystem 
      disableTransitionOnChange
    >
      <CoreInitializer />
      <div className="h-screen flex bg-background">
        <SiteSidebar isCollapsed={isCollapsed} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <SiteHeader 
            isCollapsed={isCollapsed} 
            onCollapse={() => setIsCollapsed(!isCollapsed)} 
          />
          <main className="flex-1 overflow-y-auto p-8">
            {children}
          </main>
        </div>
      </div>
      <Toaster richColors />
    </ThemeProvider>
  );
} 
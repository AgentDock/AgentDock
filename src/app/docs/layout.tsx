import { Metadata } from 'next';
import { ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { docSections } from '@/lib/docs-config';
import { generateSidebar } from '@/lib/docs-utils';
import { DocsSidebar } from './components/docs-sidebar';
import './docs.css';

export const metadata: Metadata = {
  title: 'AgentDock Documentation',
  description: 'AgentDock official documentation',
};

// Generate sidebar sections from the config
const sidebarSections = generateSidebar(docSections);

interface DocsLayoutProps {
  children: ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="relative min-h-screen bg-background">
      {/* Mobile header */}
      <header className="md:hidden flex h-14 items-center gap-4 border-b border-border/40 bg-background px-4">
        <Link href={{ pathname: '/docs' }} className="flex items-center gap-2 font-semibold">
          AgentDock Core Documentation
        </Link>
        
        <div className="ml-auto flex items-center gap-2">
          <label 
            htmlFor="sidebar-mobile-toggle" 
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/40 text-sm font-medium"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </label>
        </div>
      </header>
      
      <div className="flex flex-1">
        {/* Mobile sidebar toggle */}
        <input
          type="checkbox"
          id="sidebar-mobile-toggle"
          className="peer hidden"
        />
        
        {/* Backdrop overlay for mobile - appears when sidebar is open */}
        <label 
          htmlFor="sidebar-mobile-toggle" 
          className="fixed inset-0 z-40 bg-black/50 hidden peer-checked:block md:hidden"
          aria-hidden="true"
        />
        
        {/* Sidebar - fixed position on mobile, normal on desktop */}
        <aside className="fixed top-14 left-0 z-50 h-[calc(100%-3.5rem)] w-80 max-w-[85%] border-r border-border/40 bg-background overflow-auto -translate-x-full peer-checked:translate-x-0 md:static md:top-0 md:h-auto md:z-auto md:w-64 md:min-w-64 md:flex-shrink-0 md:block md:transform-none">
          <DocsSidebar sidebarSections={sidebarSections} />
        </aside>
        
        {/* Main content */}
        <main className="flex-1 overflow-auto">
          <div className="container py-8 px-4 md:px-8 max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
} 
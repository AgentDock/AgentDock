import { ReactNode } from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { docSections } from '@/lib/docs-config';
import { generateSidebar } from '@/lib/docs-utils';
import { DocsSidebar } from './components/docs-sidebar';

import './docs.css';

export const metadata: Metadata = {
  title: 'AgentDock Documentation',
  description: 'AgentDock official documentation'
};

// Generate sidebar sections from the config
const sidebarSections = generateSidebar(docSections);

interface DocsLayoutProps {
  children: ReactNode;
}

export default function DocsLayout({ children }: DocsLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Mobile header */}
      <header className="md:hidden flex h-14 items-center gap-4 border-b border-border/40 bg-background px-4 sticky top-0 z-50">
        <Link
          href={{ pathname: '/docs' }}
          className="flex items-center gap-2 font-semibold"
        >
          AgentDock Core Documentation
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <label
            htmlFor="sidebar-mobile-toggle"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border/40 text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
          </label>
        </div>
      </header>

      {/* Container for sidebar and main content */}
      <div className="docs-layout">
        {/* Mobile sidebar toggle */}
        <input
          type="checkbox"
          id="sidebar-mobile-toggle"
          className="docs-sidebar-toggle hidden"
        />

        {/* Backdrop overlay for mobile - appears when sidebar is open */}
        <label
          htmlFor="sidebar-mobile-toggle"
          className="fixed inset-0 z-40 bg-black/50 hidden docs-sidebar-backdrop md:hidden"
          aria-hidden="true"
        />

        {/* Sidebar - fixed position on mobile, sticky on desktop */}
        <aside className="docs-sidebar fixed top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-80 max-w-[85%] border-r border-border/40 bg-background -translate-x-full md:z-30 md:w-64 md:translate-x-0 transition-transform duration-300">
          <div className="flex md:hidden items-center justify-end p-4">
            <label
              htmlFor="sidebar-mobile-toggle"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/40 text-sm cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close Menu</span>
            </label>
          </div>
          <DocsSidebar sidebarSections={sidebarSections} />
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-x-hidden">
          <div className="container py-8 px-4 md:px-8 max-w-4xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

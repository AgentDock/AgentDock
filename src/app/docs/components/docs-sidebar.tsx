"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { Separator } from '@/components/ui/separator';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { DocSearch } from './doc-search';
import { SidebarSection } from '@/lib/docs-utils';
import Link from 'next/link';

interface DocsSidebarProps {
  sidebarSections: SidebarSection[];
}

// Function to close the mobile sidebar - exported for use in other components
export function closeMobileSidebar() {
  // Find and uncheck the sidebar toggle checkbox
  if (typeof window !== 'undefined') {
    const sidebarToggle = document.getElementById('sidebar-mobile-toggle') as HTMLInputElement;
    if (sidebarToggle) {
      sidebarToggle.checked = false;
    }
  }
}

export function DocsSidebar({ sidebarSections }: DocsSidebarProps) {
  const pathname = usePathname();
  const isMainDocsPage = pathname === '/docs' || pathname === '/docs/';
  const initialized = useRef(false);
  
  // Check if a link should be considered active
  const isLinkActive = useCallback((linkHref: string): boolean => {
    // Special case for the Introduction link which maps to the main docs page
    if (isMainDocsPage && linkHref === '/docs/') {
      return true;
    }
    
    // Normalize paths for comparison
    const normalizedHref = linkHref.endsWith('/') ? linkHref.slice(0, -1) : linkHref;
    const normalizedPathname = pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    
    return normalizedPathname === normalizedHref;
  }, [isMainDocsPage, pathname]);
  
  // Calculate which section contains the active link
  const activeSectionTitle = useMemo(() => {
    if (isMainDocsPage) return "Overview";
    
    for (const section of sidebarSections) {
      if (section.items.some(item => isLinkActive(item.href))) {
        return section.title;
      }
    }
    
    return null;
  }, [sidebarSections, isMainDocsPage, isLinkActive]);
  
  // State for expanded sections
  const [expandedSections, setExpandedSections] = useState<{[key: string]: boolean}>({});

  // Initialize expanded state ONLY ONCE on mount
  useEffect(() => {
    if (!initialized.current) {
      const initialState: {[key: string]: boolean} = {};
      
      // Always expand Overview section
      initialState["Overview"] = true;
      
      // Expand the section containing the active page
      if (activeSectionTitle && activeSectionTitle !== "Overview") {
        initialState[activeSectionTitle] = true;
      }
      
      setExpandedSections(initialState);
      initialized.current = true;
    }
  }, [activeSectionTitle]);

  // Toggle section expansion
  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  // Handle link click
  const handleLinkClick = () => {
    // Only close on mobile
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      closeMobileSidebar();
    }
  };

  return (
    <div className="py-8 w-full h-full overflow-y-auto scrollbar-thin">
      <div className="px-6 space-y-6">
        <div>
          <h2 className="text-xl font-semibold mb-2">Documentation</h2>
          <p className="text-sm text-muted-foreground mb-6">
            AgentDock Core
          </p>
        </div>
        
        <div className="mb-4">
          <DocSearch />
        </div>
        
        <Separator className="my-6" />
        
        <nav className="space-y-6">
          {sidebarSections.map((section) => (
            <div key={section.title} className="space-y-1">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full py-1.5 text-left text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                aria-expanded={expandedSections[section.title]}
              >
                <span className="font-medium text-sm uppercase tracking-wide">
                  {section.title}
                </span>
                <span className="flex items-center justify-center h-5 w-5">
                  {expandedSections[section.title] ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </span>
              </button>
              
              {expandedSections[section.title] && (
                <div className="mt-1 space-y-1">
                  {section.items.map((item) => {
                    // For the Introduction link, check if we're on the main docs page
                    const isActive = item.title === "Introduction" && isMainDocsPage
                      ? true 
                      : isLinkActive(item.href);
                    
                    return (
                      <Link
                        key={item.href}
                        href={item.href as any}
                        onClick={handleLinkClick}
                        className={`block text-sm py-2 px-3 rounded-md transition-colors ${
                          isActive 
                            ? 'bg-primary/10 text-primary font-medium' 
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                        }`}
                      >
                        {item.title}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>
      </div>
    </div>
  );
} 
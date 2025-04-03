"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Settings, Image, ChevronRight, ChevronDown, LucideIcon, FileText } from "lucide-react"
import { Logo } from "@/components/ui/logo"
import { AGENT_TAGS } from "@/config/agent-tags"
import { useState } from "react"
import { useSidebar } from "./layout-content"
import { Button } from "@/components/ui/button"

interface NavigationItemData {
  name: string;
  href: string;
  icon?: LucideIcon;
  children?: NavigationItemData[];
  autoCollapse?: boolean;
}

// Core navigation items (main platform features)
const coreNavigationItems: NavigationItemData[] = [
  {
    name: "Agents",
    href: "/agents",
    icon: Bot,
    children: [
      {
        name: "Featured",
        href: "/agents",
      },
      {
        name: "All Agents",
        href: "/agents/all",
      }
      // Main categories will be added here
    ]
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings
  },
  {
    name: "Docs",
    href: "/docs",
    icon: FileText,
    autoCollapse: true
  }
];

// Populate only the main categories (from AGENT_TAGS)
AGENT_TAGS
  .sort((a, b) => a.order - b.order)
  .filter(tag => tag.id !== 'featured') // Skip featured since we added it manually
  .forEach(tag => {
    if (coreNavigationItems[0].children) {
      coreNavigationItems[0].children.push({
        name: tag.name,
        href: `/agents/${tag.id}`,
      });
    }
  });

// Additional platform features
const additionalNavigationItems: NavigationItemData[] = [
  {
    name: "Image Generation",
    href: "/image-generation",
    icon: Image
  }
];

interface SiteSidebarProps {
  isCollapsed: boolean;
}

export function SiteSidebar({ isCollapsed }: SiteSidebarProps) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["Agents"]);
  const { setIsCollapsed } = useSidebar(); // Only need setIsCollapsed

  const toggleExpanded = (name: string) => {
    setExpandedItems(prev =>
      prev.includes(name)
        ? prev.filter(item => item !== name)
        : [...prev, name]
    );
  };

  // Simplified isActive check directly using pathname
  const isActive = (itemPath: string, itemName?: string): boolean => {
    // Special case for Featured
    if (itemName === "Featured" && itemPath === "/agents") {
      return pathname === "/agents";
    }
    // Exact match
    if (pathname === itemPath) {
      return true;
    }
    // Child path match (handles /agents/category correctly)
    if (itemPath !== '/' && pathname.startsWith(itemPath + (itemPath.endsWith('/') ? '' : '/')) && itemPath.length > 1) {
      // Ensure it's not just a partial match for non-category paths
       if (!itemPath.startsWith('/agents/')) {
         const pathSegments = pathname.split('/');
         const itemSegments = itemPath.split('/');
         // Only active if the segment count matches or the next segment starts the child path
         return pathSegments.length === itemSegments.length || (pathSegments.length > itemSegments.length)
       }
       return true
    }
     // Handle /agents/all specifically
     if (itemPath === '/agents/all' && pathname === '/agents/all'){
       return true
     }

    return false;
  };

  const renderItem = (item: NavigationItemData) => {
    const isItemActive = isActive(item.href, item.name);
    const isExpanded = expandedItems.includes(item.name);

    if (item.children) {
      // Parent Item Rendering with Wrapper Div
      return (
        <div key={item.name} className="group/sidebar-item">
          {/* Wrapper Div handles background, rounding, and base layout */}
          <div
            className={cn(
              "flex w-full items-center rounded-md transition-colors", // Base: flex, center items, full round
              // Active State (Applies blue background to the whole wrapper)
              isItemActive 
                ? "bg-primary/10 text-primary" 
                : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
              // Specific collapsed styles if needed (like centering content if link takes full width)
              isCollapsed && "justify-center px-3 py-2" // Add padding when collapsed
            )}
          >
            {/* Link - No background/rounding, handles text/icon & navigation */}
            <Link
              href={{ pathname: item.href }}
              // Remove background/rounding, adjust flex/padding as needed
              className={cn(
                "flex items-center gap-2.5 text-sm font-medium",
                isCollapsed ? "flex-none" : "flex-1 px-3 py-2" // Link takes full width when collapsed, padding only when expanded
              )}
              onClick={(e) => {
                // Toggle expansion only if applicable, allow navigation otherwise
                if (isCollapsed) { 
                    e.preventDefault(); // Prevent nav when collapsed, force expansion
                    setIsCollapsed(false); // Use context to expand sidebar
                    setTimeout(() => toggleExpanded(item.name), 50); 
                    return; 
                }
                if (!isExpanded) { 
                    toggleExpanded(item.name);
                } 
                // Allow navigation to proceed unless expansion was triggered
                if (item.autoCollapse) {
                  setIsCollapsed(true);
                }
              }}
            >
              {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
            
            {/* Toggle Button - No background/rounding, handles chevron & toggle action */}
            {!isCollapsed && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { 
                    e.stopPropagation(); // Prevent click propagating to Link
                    toggleExpanded(item.name); 
                }}
                // Remove rounding/background, adjust padding/opacity
                className="h-auto px-2 py-2 opacity-60 hover:opacity-100 bg-transparent hover:bg-transparent"
                aria-label={isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`}
              >
                {isExpanded ?
                  <ChevronDown className="h-4 w-4" /> :
                  <ChevronRight className="h-4 w-4" />
                }
              </Button>
            )}
          </div>
          
          {/* Render children links (Remains the same) */}
          {!isCollapsed && isExpanded && (
            <div className="mt-1 space-y-0.5 pl-5 border-l border-border/40 ml-5">
              {item.children.map(renderItem)} 
            </div>
          )}
        </div>
      );
    }

    // Render simple link (no children) - Styling remains largely the same
    return (
      <Link
        key={item.name}
        href={{ pathname: item.href }}
        className={cn(
          // Base styles
          "flex items-center gap-2.5 px-3 py-2 text-sm font-medium transition-colors rounded-md", 
          // Add left padding if it's a sub-item (no icon expected)
          !item.icon && !isCollapsed && "pl-7",
          // Collapsed Styles
          isCollapsed && "w-full justify-center", // Full width, Center icon 
          isItemActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground",
        )}
        onClick={() => {
          if (item.autoCollapse) {
            setIsCollapsed(true);
          }
        }}
      >
        {item.icon && <item.icon className="h-4 w-4 flex-shrink-0" />}
        {!isCollapsed && <span className="truncate">{item.name}</span>}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r border-border/40 bg-background transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[70px]" : "w-[240px]",
        "hidden md:block"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b border-border/40 px-4 justify-center">
          <Logo showText={!isCollapsed} />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-4">
            {/* Core Platform Section */}
            <div>
              <h2 className={cn(
                "mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                isCollapsed && "text-center"
              )}>
                {!isCollapsed ? "Core" : "C"}
              </h2>
              <nav className="flex flex-col gap-0.5 px-4">
                {coreNavigationItems.map(renderItem)}
              </nav>
            </div>

            {/* Additional Features Section */}
            <div>
              <h2 className={cn(
                "mb-1 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground",
                 isCollapsed && "text-center"
              )}>
                 {!isCollapsed ? "Features" : "F"}
              </h2>
              <nav className="flex flex-col gap-0.5 px-4">
                {additionalNavigationItems.map(renderItem)}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
} 
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  ChevronDown,
  ChevronRight,
  FileText,
  Image,
  LucideIcon,
  Settings
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Logo } from '@/components/ui/logo';
import { AGENT_TAGS } from '@/config/agent-tags';
import { cn } from '@/lib/utils';

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
    name: 'Agents',
    href: '/agents',
    icon: Bot,
    children: [
      {
        name: 'Featured',
        href: '/agents'
      },
      {
        name: 'All Agents',
        href: '/agents/all'
      }
      // Main categories will be added here
    ]
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings
  },
  {
    name: 'Docs',
    href: '/docs',
    icon: FileText
  }
];

// Populate only the main categories (from AGENT_TAGS)
AGENT_TAGS.sort((a, b) => a.order - b.order)
  .filter((tag) => tag.id !== 'featured') // Skip featured since we added it manually
  .forEach((tag) => {
    if (coreNavigationItems[0].children) {
      coreNavigationItems[0].children.push({
        name: tag.name,
        href: `/agents/${tag.id}`
      });
    }
  });

// Additional platform features
const additionalNavigationItems: NavigationItemData[] = [
  {
    name: 'Image Generation',
    href: '/image-generation',
    icon: Image
  }
];

export function MobileNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(['Agents']);

  const toggleExpanded = (name: string) => {
    setExpandedItems((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  // Simplified isActive check directly using pathname
  const isActive = (itemPath: string, itemName?: string): boolean => {
    // Special case for Featured
    if (itemName === 'Featured' && itemPath === '/agents') {
      return pathname === '/agents';
    }
    // Exact match
    if (pathname === itemPath) {
      return true;
    }
    // Child path match (handles /agents/category correctly)
    if (
      itemPath !== '/' &&
      pathname.startsWith(itemPath + (itemPath.endsWith('/') ? '' : '/')) &&
      itemPath.length > 1
    ) {
      // Ensure it's not just a partial match for non-category paths
      if (!itemPath.startsWith('/agents/')) {
        const pathSegments = pathname.split('/');
        const itemSegments = itemPath.split('/');
        // Only active if the segment count matches or the next segment starts the child path
        return (
          pathSegments.length === itemSegments.length ||
          pathSegments.length > itemSegments.length
        );
      }
      return true;
    }
    // Handle /agents/all specifically
    if (itemPath === '/agents/all' && pathname === '/agents/all') {
      return true;
    }

    return false;
  };

  const renderItem = (item: NavigationItemData) => {
    const isItemActive = isActive(item.href, item.name);
    const isExpanded = expandedItems.includes(item.name);

    if (item.children) {
      return (
        <div
          key={item.name}
          className="space-y-1"
        >
          <div
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2',
              isItemActive
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
            )}
          >
            <Link
              href={{ pathname: item.href }}
              className="flex flex-1 items-center gap-3"
              onClick={(e) => {
                if (!isExpanded) {
                  e.preventDefault();
                  toggleExpanded(item.name);
                } else if (onNavigate) {
                  onNavigate();
                }
              }}
            >
              {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
              <span className="text-sm font-medium">{item.name}</span>
            </Link>

            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(item.name);
              }}
              className="h-auto p-1 opacity-70 hover:opacity-100 bg-transparent hover:bg-transparent"
              aria-label={
                isExpanded ? `Collapse ${item.name}` : `Expand ${item.name}`
              }
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>

          {isExpanded && (
            <div className="mt-1 space-y-1 pl-5 border-l border-border/40 ml-5">
              {item.children.map((child) => (
                <Link
                  key={child.name}
                  href={{ pathname: child.href }}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive(child.href, child.name)
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
                  )}
                  onClick={() => {
                    if (onNavigate) {
                      onNavigate();
                    }
                  }}
                >
                  <span>{child.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={item.name}
        href={{ pathname: item.href }}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isItemActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground'
        )}
        onClick={() => {
          if (onNavigate) {
            onNavigate();
          }
        }}
      >
        {item.icon && <item.icon className="h-5 w-5 flex-shrink-0" />}
        <span>{item.name}</span>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center border-b border-border/40 px-4">
        <Logo showText={true} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-6">
          {/* Core Platform Section */}
          <div className="px-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Core
            </h2>
            <nav className="flex flex-col gap-1">
              {coreNavigationItems.map(renderItem)}
            </nav>
          </div>

          {/* Additional Features Section */}
          <div className="px-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Features
            </h2>
            <nav className="flex flex-col gap-1">
              {additionalNavigationItems.map(renderItem)}
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}

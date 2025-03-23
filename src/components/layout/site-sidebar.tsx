"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Settings, Image, LucideIcon } from "lucide-react"
import { Logo } from "@/components/ui/logo"

interface NavigationItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// Core navigation items (main platform features)
const coreNavigationItems: NavigationItem[] = [
  {
    name: "Agents",
    href: "/agents",
    icon: Bot
  },
  {
    name: "Settings",
    href: "/settings",
    icon: Settings
  }
];

// Additional platform features
const additionalNavigationItems: NavigationItem[] = [
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
  const pathname = usePathname()

  return (
    <aside 
      className={cn(
        "fixed left-0 top-0 z-40 h-screen border-r bg-sidebar transition-all duration-300 ease-in-out",
        isCollapsed ? "w-[70px]" : "w-[240px]",
        "hidden md:block"
      )}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-14 items-center border-b px-4 justify-center">
          <Logo showText={!isCollapsed} />
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-6">
            {/* Core Platform Section */}
            <div>
              <h2 className={cn(
                "mb-2 px-6 text-xs font-semibold text-sidebar-foreground/70",
                isCollapsed && "sr-only"
              )}>
                Core
              </h2>
              <nav className="flex flex-col gap-1 px-3">
                {coreNavigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={cn(
                      "flex items-center gap-2 rounded-md mx-1 px-3 py-2 text-sm font-medium transition-colors",
                      pathname === item.href 
                        ? "bg-primary/10 text-primary" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                ))}
              </nav>
            </div>

            {/* Additional Features Section */}
            <div>
              <h2 className={cn(
                "mb-2 px-6 text-xs font-semibold text-sidebar-foreground/70",
                isCollapsed && "sr-only"
              )}>
                Features
              </h2>
              <nav className="flex flex-col gap-1 px-3">
                {additionalNavigationItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href as any}
                    className={cn(
                      "flex items-center gap-2 rounded-md mx-1 px-3 py-2 text-sm font-medium transition-colors",
                      pathname === item.href 
                        ? "bg-primary/10 text-primary" 
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      isCollapsed && "justify-center"
                    )}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </Link>
                ))}
              </nav>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
} 
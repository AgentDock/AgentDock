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

export function MobileNav() {
  const pathname = usePathname()
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center border-b px-4">
        <Logo showText={true} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <div className="space-y-6">
          {/* Core Platform Section */}
          <div className="px-4">
            <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
              Core
            </h2>
            <nav className="flex flex-col gap-2">
              {coreNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Additional Features Section */}
          <div className="px-4">
            <h2 className="mb-2 text-xs font-semibold text-muted-foreground">
              Features
            </h2>
            <nav className="flex flex-col gap-2">
              {additionalNavigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as any}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </div>
  )
} 



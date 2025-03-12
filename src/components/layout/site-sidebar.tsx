"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Settings, Home } from "lucide-react"
import { Logo } from "@/components/ui/logo"

const navigationItems = [
  {
    name: "Home",
    href: "/",
    icon: Home
  },
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
] as const

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
          <nav className="flex flex-col gap-1 px-2">
            {navigationItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === item.href 
                    ? "bg-primary/10 text-primary" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                {!isCollapsed && <span>{item.name}</span>}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </aside>
  )
} 
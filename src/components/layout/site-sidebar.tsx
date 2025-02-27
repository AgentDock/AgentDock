"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    <div className="flex">
      <nav className={cn(
        "hidden border-r bg-background md:block transition-all duration-300",
        isCollapsed ? "w-[70px]" : "w-[240px]"
      )}>
        <div className="flex h-full flex-col">
          <div className="flex h-14 items-center border-b px-4 justify-center">
            <Logo showText={!isCollapsed} />
          </div>
          <ScrollArea className="flex-1 py-2">
            <div className="flex flex-col gap-1 px-2">
              {navigationItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                    pathname === item.href 
                      ? "bg-primary/10 text-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {!isCollapsed && <span>{item.name}</span>}
                </Link>
              ))}
            </div>
          </ScrollArea>
        </div>
      </nav>
    </div>
  )
} 
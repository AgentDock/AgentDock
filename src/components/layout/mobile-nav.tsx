"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Bot, Settings, Boxes, Home } from "lucide-react"
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

export function MobileNav() {
  const pathname = usePathname()
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex h-14 items-center border-b px-4">
        <Logo showText={true} />
      </div>
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="flex flex-col gap-2 px-4">
          {navigationItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
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
  )
} 



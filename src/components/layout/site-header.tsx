"use client"

import { Sun, Moon, PanelLeftClose, PanelLeftOpen, Menu, Github } from "lucide-react"
import { useTheme } from "next-themes"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { MobileNav } from "@/components/layout/mobile-nav"
import Link from "next/link"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface SiteHeaderProps {
  isCollapsed: boolean;
  onCollapse: () => void;
}

export function SiteHeader({ isCollapsed, onCollapse }: SiteHeaderProps) {
  const { setTheme, theme } = useTheme()

  // Add debugging for theme changes
  const safeSetTheme = (newTheme: string) => {
    console.log(`Manual theme change to: ${newTheme}`, {
      previousTheme: theme,
      timestamp: new Date().toISOString(),
      source: 'site-header'
    });
    
    // Throttle changes to prevent rapid toggling
    setTheme(newTheme);
  }

  return (
    <header 
      className="sticky top-0 z-30 w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ 
        transform: "translateZ(0)",
        willChange: "transform"
      }}
    >
      <div className="flex h-14 items-center px-4">
        <div className="flex items-center space-x-2">
          {/* Mobile Menu Button */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="Open mobile menu"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              <MobileNav onNavigate={() => {
                // Close the sheet when a navigation item is clicked
                const closeButton = document.querySelector('[data-radix-sheet-close]') as HTMLButtonElement | null;
                if (closeButton) closeButton.click();
              }} />
            </SheetContent>
          </Sheet>

          {/* Desktop Collapse Button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onCollapse}
            className="hidden md:flex"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Right side actions */}
        <div className="ml-auto flex items-center space-x-2">
          {/* GitHub Link */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Link 
                  href="https://github.com/agentdock/agentdock" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <Button variant="ghost" size="icon" className="relative h-9 w-9">
                    <Github className="h-5 w-5" />
                    <span className="sr-only">GitHub Repository</span>
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent>
                <p>View on GitHub</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Theme Toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const newTheme = theme === "dark" ? "light" : "dark";
              safeSetTheme(newTheme);
            }}
            className="relative h-9 w-9"
            aria-label="Toggle theme"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
          </Button>
        </div>
      </div>
    </header>
  )
} 
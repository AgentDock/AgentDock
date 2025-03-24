"use client"

import { memo } from "react"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Type } from "lucide-react"
import { fontOptions, FontFamily, monoFonts } from "@/lib/fonts"

interface FontSettingsProps {
  settings: {
    fonts: {
      primary: FontFamily
      mono: string
    }
  }
  onPrimaryFontChange: (value: FontFamily) => void
  onMonoFontChange: (value: string) => void
}

function FontSettingsComponent({ 
  settings, 
  onPrimaryFontChange, 
  onMonoFontChange 
}: FontSettingsProps) {
  return (
    <Card>
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-2 mb-2">
          <Type className="h-5 w-5" />
          <h3 className="text-lg font-medium">Font Settings</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Customize the application typography
        </p>
        
        <div className="grid gap-6">
          {/* Primary Font Selection */}
          <div className="grid gap-2">
            <div className="space-y-2">
              <Label>Primary Font</Label>
              <p className="text-sm text-muted-foreground">
                The main font used throughout the application
              </p>
              <Select 
                value={settings.fonts.primary} 
                onValueChange={onPrimaryFontChange as any}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a font" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(fontOptions).map(([key, font]) => (
                    <SelectItem key={key} value={key}>
                      <span>{font.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-primary mt-2">
                Current font: {fontOptions[settings.fonts.primary]?.name}
              </p>
            </div>
          </div>
          
          <Separator />
          
          {/* Monospace Font Selection */}
          <div className="grid gap-2">
            <div className="space-y-2">
              <Label>Code Font</Label>
              <p className="text-sm text-muted-foreground">
                Font used for code blocks and monospace content
              </p>
              <Select 
                value={settings.fonts.mono} 
                onValueChange={onMonoFontChange}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a monospace font" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">
                    <span>Default Monospace</span>
                  </SelectItem>
                  {Object.entries(monoFonts).map(([key, font]) => (
                    <SelectItem key={key} value={key}>
                      <span>{font.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-primary mt-2">
                Current font: {settings.fonts.mono === 'default' ? 'Default Monospace' : 
                  monoFonts[settings.fonts.mono as keyof typeof monoFonts]?.name || 'Default'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}

// Memoize the component to prevent unnecessary re-renders
export const FontSettings = memo(FontSettingsComponent); 
"use client"

import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Button } from "@/components/ui/button"

type CopyButtonProps = {
  content: string
  copyMessage?: string
  size?: "default" | "small"
}

export function CopyButton({ content, copyMessage, size = "default" }: CopyButtonProps) {
  const { isCopied, handleCopy } = useCopyToClipboard({
    text: content,
    copyMessage,
  })

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn(
        "relative",
        size === "default" ? "h-6 w-6" : "h-5 w-5"
      )}
      aria-label="Copy to clipboard"
      onClick={handleCopy}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <Check
          className={cn(
            "transition-transform ease-in-out",
            size === "default" ? "h-4 w-4" : "h-3 w-3",
            isCopied ? "scale-100" : "scale-0"
          )}
        />
      </div>
      <Copy
        className={cn(
          "transition-transform ease-in-out",
          size === "default" ? "h-4 w-4" : "h-3 w-3",
          isCopied ? "scale-0" : "scale-100"
        )}
      />
    </Button>
  )
}

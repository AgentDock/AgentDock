import { Dot } from "lucide-react"

export function TypingIndicator() {
  return (
    <div className="flex items-center space-x-2">
      <div className="flex -space-x-1">
        <Dot className="h-3 w-3 animate-typing-dot-bounce" />
        <Dot className="h-3 w-3 animate-typing-dot-bounce [animation-delay:150ms]" />
        <Dot className="h-3 w-3 animate-typing-dot-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

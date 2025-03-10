import { useEffect, useRef, useState } from "react"

// How many pixels from the bottom of the container to enable auto-scroll
const ACTIVATION_THRESHOLD = 50

export function useAutoScroll(dependencies: React.DependencyList, options?: { 
  // If true, will force scroll to bottom (like when sending a new message)
  forceScroll?: boolean
}) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [isAtBottom, setIsAtBottom] = useState(true)

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }

  const handleScroll = () => {
    if (!containerRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    
    // Update if we're at bottom or not
    setIsAtBottom(distanceFromBottom < ACTIVATION_THRESHOLD)
  }

  // Extract the first dependency for the primary effect trigger
  // This is typically the messages array or other content that changes
  const primaryDependency = dependencies[0]

  useEffect(() => {
    // Only scroll if:
    // 1. Force scroll is requested (new message sent) OR
    // 2. We were already at the bottom
    if (options?.forceScroll || isAtBottom) {
      scrollToBottom()
    }
  }, [primaryDependency, isAtBottom, options?.forceScroll])

  return {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldShowScrollButton: !isAtBottom
  }
}

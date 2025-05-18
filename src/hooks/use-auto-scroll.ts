import { useEffect, useRef, useState } from 'react';

// How many pixels from the bottom of the container to enable auto-scroll
const ACTIVATION_THRESHOLD = 50;

/**
 * Disabled auto-scroll hook that does nothing to avoid React maximum update depth errors
 * This is a temporary measure to identify the root cause
 */
export function useAutoScroll(
  dependencies: React.DependencyList,
  options?: {
    // If true, will force scroll to bottom (like when sending a new message)
    forceScroll?: boolean;
  },
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldShowScrollButton, setShouldShowScrollButton] = useState(false);

  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  };

  const handleScroll = () => {
    if (!containerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

    // Only update state if the value would change - prevents render loops
    const shouldShowButton = distanceFromBottom >= ACTIVATION_THRESHOLD;
    if (shouldShowButton !== shouldShowScrollButton) {
      setShouldShowScrollButton(shouldShowButton);
    }
  };

  // Set up scroll event listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll);
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Auto-scroll effect - using a separate effect to avoid dependencies on handleScroll
  useEffect(() => {
    // Get current values to avoid stale closures
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isNearBottom = distanceFromBottom < ACTIVATION_THRESHOLD;

    // Only scroll if:
    // 1. Force scroll is requested (new message sent) OR
    // 2. We were already at the bottom
    if (options?.forceScroll || isNearBottom) {
      // Use setTimeout for more reliable DOM updates
      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
      }, 0);
    }
  }, dependencies);

  return {
    containerRef,
    scrollToBottom,
    handleScroll,
    shouldShowScrollButton,
  };
}

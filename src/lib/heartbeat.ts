/**
 * Heartbeat Animation Utilities
 * Provides reusable hooks and functions for tool execution visualizations
 */
import { useState, useEffect, useRef } from 'react';

/**
 * Hook that tracks elapsed time since component mounted
 * Returns formatted time string and raw milliseconds
 */
export function useElapsedTime(): [string, number] {
  const [elapsedTime, setElapsedTime] = useState<number>(0);
  const startTimeRef = useRef<number>(performance.now());
  const animationFrameRef = useRef<number | null>(null);
  
  useEffect(() => {
    const updateTimer = () => {
      const now = performance.now();
      const elapsed = now - startTimeRef.current;
      setElapsedTime(elapsed);
      animationFrameRef.current = requestAnimationFrame(updateTimer);
    };
    
    // Start the animation frame loop
    animationFrameRef.current = requestAnimationFrame(updateTimer);
    
    // Cleanup function to cancel animation frame
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);
  
  return [formatElapsedTime(elapsedTime), elapsedTime];
}

/**
 * Format elapsed time as seconds with milliseconds
 */
export function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = Math.floor(ms % 1000);
  return `${seconds}.${milliseconds.toString().padStart(3, '0')}s`;
}

/**
 * CSS props for applying the heartbeat gradient animation
 */
export const heartbeatGradientProps = {
  className: "absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/30 to-primary/5 -z-10 opacity-85",
  style: {
    animation: "pulse-gradient 2s infinite ease-in-out",
    backgroundSize: "200% 100%",
  }
};

/**
 * Timer display component props
 */
export const timerDisplayProps = {
  className: "text-xs font-mono bg-primary/10 text-primary px-2 py-0.5 rounded-full absolute top-2 right-3",
  style: {}
}; 
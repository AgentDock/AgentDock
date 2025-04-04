/**
 * @fileoverview Chat page loading component
 * Uses the existing ChatSkeleton component for a consistent loading experience
 */

import { ChatSkeleton } from "@/components/chat/ChatSkeleton";

export default function Loading() {
  return <ChatSkeleton />;
} 
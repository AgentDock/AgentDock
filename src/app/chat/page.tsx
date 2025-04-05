import { Suspense } from "react"
import { Metadata } from 'next'
import { templates, TemplateId } from '@/generated/templates'
import { siteConfig } from '@/lib/config'
import ChatClientPage from './chat-client' // Import the new client component
import { ChatSkeleton } from "@/components/chat/ChatSkeleton"

// Generate dynamic metadata based on the agent (Server-side)
export async function generateMetadata(
  { searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }
): Promise<Metadata> {
  const agentId = searchParams?.agent as string | undefined;
  const agentName = agentId && templates[agentId as TemplateId] ? templates[agentId as TemplateId].name : null;
  
  const title = agentName ? agentName : `Chat`; 
  
  return {
    title: title,
  };
}

// This is now a Server Component responsible for metadata and rendering the client part
export default function ChatPage() {
  return (
    // The Suspense boundary can remain here or be moved into the client component
    // Keeping it here can help with initial server rendering of the fallback
    <Suspense fallback={<ChatSkeleton />}>
      <ChatClientPage />
    </Suspense>
  )
} 
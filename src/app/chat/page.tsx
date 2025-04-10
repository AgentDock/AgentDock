import { Suspense } from "react"
import { Metadata } from 'next'
import { templates, TemplateId } from '@/generated/templates'
import ChatClientPage from './chat-client' // Import the new client component
import { ChatSkeleton } from "@/components/chat/ChatSkeleton"
import { generatePageMetadata } from "@/lib/metadata-utils"
import type { AgentTemplate } from "@/lib/store/types"

type PageParams = Record<string, never>; // Empty params object since chat page has no dynamic route params
type SearchParams = { [key: string]: string | string[] | undefined };

// Generate dynamic metadata based on the agent (Server-side)
export async function generateMetadata({
  searchParams,
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}): Promise<Metadata> {
  const resolvedSearchParams = await searchParams;
  const agentId = resolvedSearchParams?.agent as string | undefined;
  const template = agentId && templates[agentId as TemplateId] 
    ? templates[agentId as TemplateId] as unknown as AgentTemplate 
    : null;
  
  // If we have a template, use its details
  if (template) {
    const title = `${template.name} - Chat`;
    const description = template.description || `Chat with ${template.name} on AgentDock`;
    
    return generatePageMetadata({
      title,
      description,
      ogImageParams: {
        title: template.name,
        // Use a chat-specific gradient
        from: '4F46E5',
        to: '1E3A8A',
      }
    });
  }
  
  // Fallback for cases when there is no agent specified
  return generatePageMetadata({
    title: 'Chat',
    description: 'Chat with AI agents on AgentDock',
  });
}

// This is now a Server Component responsible for metadata and rendering the client part
export default function ChatPage({
  searchParams: _searchParams, // Prefix with underscore to indicate it's not used
}: {
  params: Promise<PageParams>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<ChatSkeleton />}>
      <ChatClientPage />
    </Suspense>
  )
} 
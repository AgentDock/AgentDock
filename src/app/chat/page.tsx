import { Suspense } from "react"
import { Metadata } from 'next'
import { templates, TemplateId } from '@/generated/templates'
import ChatClientPage from './chat-client' // Import the new client component
import { ChatSkeleton } from "@/components/chat/ChatSkeleton"

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
  const agentName = agentId && templates[agentId as TemplateId] ? templates[agentId as TemplateId].name : null;
  
  const title = agentName ? agentName : `Chat`; 
  
  return {
    title: title,
  };
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
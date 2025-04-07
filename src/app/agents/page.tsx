/**
 * @fileoverview AI Agents page with modern card layout and settings management
 * Implemented as a Server Component for optimal performance with skeleton-based loading
 */

import { templates } from '@/generated/templates';
import type { AgentTemplate } from "@/lib/store/types";
import { Suspense } from "react";
import { AgentLoading } from "@/components/agents/AgentLoading";

// Import with a dynamic import to ensure it's a client component
import ClientWrapper from "@/app/agents/client-wrapper";

export default function AgentsPage() {
  // This is now a server component - we can fetch data directly
  const allTemplates = Object.values(templates) as unknown as AgentTemplate[];
  
  // Filter featured agents on the server
  const featuredTemplates = allTemplates.filter(template => 
    template.tags?.includes('featured') || false
  );
  
  return (
    // Suspense boundary uses the existing AgentLoading component
    <Suspense fallback={<AgentLoading />}>
      <div className="container py-6 space-y-6 md:py-10">
        {/* Client components for interactive parts */}
        <ClientWrapper 
          templates={featuredTemplates}
          initialCategory="featured"
        />
      </div>
    </Suspense>
  );
} 
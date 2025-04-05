import { notFound } from "next/navigation"
import { CategoryPage } from "@/components/agents/CategoryPage"
import { AGENT_TAGS } from "@/config/agent-tags"
import { templates } from '@/generated/templates'
import { hasTag } from "@/lib/utils"
import type { AgentTemplate } from "@/lib/store/types"
import { use } from "react"

// This is a server component
export default function CategoryPageServer({ params }: { params: Promise<{ category: string }> }) {
  // Unwrap the params Promise
  const resolvedParams = use(params)
  const category = resolvedParams.category
  
  // Get all templates
  const allTemplates = Object.values(templates) as unknown as AgentTemplate[]
  
  // Get the current category info
  const currentCategory = AGENT_TAGS.find(tag => tag.id === category)
  
  // Pre-filter templates by category on the server
  const filteredTemplates = allTemplates.filter(template => {
    if (category === 'all') return true
    if (category === 'featured') return hasTag(template, 'featured')
    return hasTag(template, category)
  })
  
  // If no templates match this category (server-side check)
  if (filteredTemplates.length === 0) {
    notFound()
  }

  return (
    <CategoryPage 
      category={category}
      categoryName={currentCategory?.name || category}
      templates={filteredTemplates}
    />
  )
} 
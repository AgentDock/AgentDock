import { notFound } from "next/navigation"
import { Metadata } from 'next' // Import Metadata type
import { CategoryPage } from "@/components/agents/CategoryPage"
import { AGENT_TAGS } from "@/config/agent-tags"
import { templates } from '@/generated/templates'
import { hasTag } from "@/lib/utils"
import type { AgentTemplate } from "@/lib/store/types"
import { use } from "react"

// Define types for page props
type CategoryPageProps = {
  params: Promise<{ category: string }>;
  searchParams: { [key: string]: string | string[] | undefined };
};

// Generate dynamic metadata based on the category
export async function generateMetadata(
  { params }: CategoryPageProps
): Promise<Metadata> {
  const resolvedParams = await params; // Resolve the params promise
  const category = resolvedParams.category;

  // Find the display name for the category
  const currentCategory = AGENT_TAGS.find(tag => tag.id === category);
  const categoryName = currentCategory?.name || category; // Fallback to id if name not found

  // Capitalize the category name for the title
  const title = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

  return {
    title: `${title} Agents`, // Set the title like "Research Agents"
  };
}

// This is a server component
export default function CategoryPageServer({ params }: CategoryPageProps) {
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
  if (filteredTemplates.length === 0 && category !== 'all' && category !== 'featured') {
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
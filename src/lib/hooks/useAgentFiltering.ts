import { useState, useMemo } from "react"
import { hasTag } from "@/lib/utils"
import type { AgentTemplate } from "@/lib/store/types"
import Fuse from "fuse.js"

interface UseAgentFilteringProps {
  allTemplates: AgentTemplate[]
  category?: string | null
}

export function useAgentFiltering({ allTemplates, category }: UseAgentFilteringProps) {
  const [searchTerm, setSearchTerm] = useState("")
  
  const filteredTemplates = useMemo(() => {
    // Handle special categories
    if (category === 'all') {
      // 'all' category shows all templates without filtering
      return allTemplates
    } else if (category === 'featured') {
      // Featured templates are shown on the main page
      return allTemplates.filter(template => hasTag(template, 'featured'))
    } else if (category) {
      // For specific categories, filter by that tag
      return allTemplates.filter(template => hasTag(template, category))
    } else {
      // Default to featured templates on main page
      return allTemplates.filter(template => hasTag(template, 'featured'))
    }
  }, [allTemplates, category])
  
  // Apply search to filtered templates
  const searchedTemplates = useMemo(() => {
    if (!searchTerm) return filteredTemplates
    
    const fuse = new Fuse(filteredTemplates, {
      keys: ['name', 'description', 'agentId'],
      threshold: 0.4,
      ignoreLocation: true,
    })
    
    const results = fuse.search(searchTerm)
    return results.map(result => result.item)
  }, [filteredTemplates, searchTerm])
  
  const sortedTemplates = useMemo(() => {
    return [...searchedTemplates].sort((a, b) => {
      // If in featured category or all agents, put featured on top
      if (category === 'featured' || !category || category === 'all') {
        const aIsFeatured = hasTag(a, 'featured')
        const bIsFeatured = hasTag(b, 'featured')
        
        if (aIsFeatured && !bIsFeatured) return -1
        if (!aIsFeatured && bIsFeatured) return 1
      }
      
      // Sort by priority
      const aPriority = ('priority' in a ? a.priority : 999) as number
      const bPriority = ('priority' in b ? b.priority : 999) as number
      if (aPriority !== bPriority) {
        return aPriority - bPriority
      }
      
      // Finally, sort alphabetically
      return a.name.localeCompare(b.name)
    })
  }, [searchedTemplates, category])
  
  return {
    searchTerm,
    setSearchTerm,
    filteredTemplates: searchedTemplates,
    sortedTemplates
  }
} 
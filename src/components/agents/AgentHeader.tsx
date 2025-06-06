/**
 * AgentHeader component optimized for Server Components
 * Static parts remain as server components, while interactive parts are marked with "use client"
 */

import Link from 'next/link';
import { Plus, Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { type TagConfig } from '@/config/agent-tags';

// Compatible with both TagConfig and dynamically created category configs
export interface CategoryConfig {
  id: string;
  name: string;
  description?: string;
}

interface AgentHeaderProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryConfig?: CategoryConfig;
  onRemoveCategory?: () => void;
  isAllAgents?: boolean;
}

// Helper function to capitalize the first letter of a string
const capitalizeFirstLetter = (str: string): string => {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export function AgentHeader({
  searchTerm,
  onSearchChange,
  categoryConfig,
  onRemoveCategory,
  isAllAgents = true
}: AgentHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-1.5 sm:space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">AI Agents</h1>
          {!isAllAgents && categoryConfig && onRemoveCategory && (
            <Badge
              variant="secondary"
              className="h-7 px-2 gap-1 text-sm font-medium bg-secondary/80 hover:bg-secondary/90 transition-colors group cursor-pointer"
              onClick={onRemoveCategory}
            >
              {capitalizeFirstLetter(categoryConfig.name)}
              <X
                className="h-4 w-4 text-muted-foreground/70 group-hover:text-muted-foreground transition-colors"
                aria-label="Remove category filter"
              />
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">
          Open source AI agents and assistants
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:w-[240px] sm:flex-none">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search agents..."
            className="pl-8 pr-4 w-full"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <Link
          href="/docs/rfa/add-agent"
          passHref
        >
          <Button className="sm:w-[140px]">
            <Plus className="mr-2 h-4 w-4" />
            Add Agent
          </Button>
        </Link>
      </div>
    </div>
  );
}

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bot, MessageSquare, Settings, Github } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AGENT_TAGS } from '@/config/agent-tags';
import { getLLMInfo, cn } from '@/lib/utils';
import type { AgentTemplate } from '@/lib/store/types';
import { allTools } from '@/nodes/registry';

interface AgentCardProps {
  template: AgentTemplate;
  index: number;
  onChat: (agentId: string) => void;
  onSettings: (agentId: string) => void;
  onGithub?: (agentId: string) => void;
  currentCategory?: string;
}

export function AgentCard({
  template,
  index,
  onChat,
  onSettings,
  onGithub,
  currentCategory,
}: AgentCardProps) {
  return (
    <motion.div
      key={template.agentId}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card className="flex flex-col h-full overflow-hidden group border border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-md">
        <CardHeader className="relative pb-4">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          <div className="flex items-start justify-between relative">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                {template.name}
              </CardTitle>
              <CardDescription>{template.description}</CardDescription>
            </div>
            <Badge variant="secondary" className="px-2 py-1 h-auto bg-secondary/80">
              Ready
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 pt-0">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium">Model</div>
              <div className="text-sm text-muted-foreground">
                {getLLMInfo(template).displayName}
              </div>
            </div>

            {/* Display tags */}
            {template.tags && template.tags.length > 0 && (
              <div className="pt-1">
                <div className="text-sm font-medium mb-1.5">Categories</div>
                <div className="flex flex-wrap gap-1.5">
                  {AGENT_TAGS.filter((tag) => template.tags?.includes(tag.id))
                    .filter((tag) => tag.id !== 'featured') // Don't show featured tag in cards
                    .sort((a, b) => a.order - b.order)
                    .map((tag) => (
                      <Link href={`/agents/${tag.id}`} key={tag.id}>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'bg-secondary/80 hover:bg-secondary cursor-pointer text-xs px-2 py-0.5',
                            currentCategory === tag.id &&
                              'bg-primary/20 hover:bg-primary/30 text-primary',
                          )}
                        >
                          {tag.name}
                        </Badge>
                      </Link>
                    ))}
                  {/* Show dynamic tags that aren't in AGENT_TAGS */}
                  {template.tags
                    .filter((tag: string) => !AGENT_TAGS.some((t) => t.id === tag))
                    .map((tag: string) => (
                      <Link href={`/agents/${tag}`} key={tag}>
                        <Badge
                          variant="secondary"
                          className={cn(
                            'bg-secondary/80 hover:bg-secondary cursor-pointer text-xs px-2 py-0.5',
                            currentCategory === tag &&
                              'bg-primary/20 hover:bg-primary/30 text-primary',
                          )}
                        >
                          {tag.charAt(0).toUpperCase() + tag.slice(1)}
                        </Badge>
                      </Link>
                    ))}
                </div>
              </div>
            )}

            {template.nodes && template.nodes.length > 0 && (
              <>
                {/* Only show actual registered tools from src/nodes */}
                {template.nodes.some((node) => node in allTools) && (
                  <div className="pt-1">
                    <div className="text-sm font-medium mb-1.5">Tools</div>
                    <div className="flex flex-wrap gap-1.5">
                      {template.nodes
                        .filter((node: string) => node in allTools)
                        .map((node: string) => (
                          <Badge
                            key={node}
                            variant="outline"
                            className="bg-background/50 text-xs px-2 py-0.5"
                          >
                            {node}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex gap-2 pt-4">
          <Button onClick={() => onChat(template.agentId)} className="flex-1" variant="default">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>

          <div className="flex gap-2 flex-1">
            <Button
              onClick={() => onSettings(template.agentId)}
              className="flex-1"
              variant="outline"
              size="sm"
            >
              <Settings className="h-4 w-4" />
            </Button>

            <Button
              onClick={() => onGithub && onGithub(template.agentId)}
              className="flex-1"
              variant="outline"
              size="sm"
              disabled={!onGithub}
            >
              <Github className="h-4 w-4" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

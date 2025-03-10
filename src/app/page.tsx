/**
 * @fileoverview Main page component for AgentDock Core.
 */

"use client";

import { useEffect, useState } from "react";
import { useAgents } from "@/lib/store/index";
import type { Agent } from "@/lib/store/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Search, Brain, Globe, Send } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { LLMConfig } from "agentdock-core/llm/types";

type Mode = "research" | "reason";

interface NodeConfigurations {
  'llm.anthropic'?: LLMConfig;
  [key: string]: unknown;
}

export default function HomePage() {
  const { agents, initialize, isInitialized } = useAgents();
  const [mode, setMode] = useState<Mode>("research");
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isInitialized) {
      initialize();
    }
  }, [initialize, isInitialized]);

  const selectedAgentData = agents.find((agent: Agent) => agent.agentId === selectedAgent);
  const llmConfig = selectedAgentData?.nodeConfigurations?.['llm.anthropic'] as LLMConfig | undefined;

  const handleAgentSelect = async (agentId: string) => {
    setIsLoading(true);
    setSelectedAgent(agentId);
    setIsLoading(false);
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedAgent) return;
    
    try {
      // TODO: Implement message sending logic
      setMessage("");
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  return (
    <div className="flex-1 space-y-6">
      {/* Agent Selection */}
      <div className="flex flex-wrap gap-2 justify-center mb-8">
        {!isInitialized ? (
          Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-9 w-32" />
          ))
        ) : agents.map((agent: Agent) => (
          <Button
            key={agent.agentId}
            variant={selectedAgent === agent.agentId ? "default" : "outline"}
            className={cn("gap-2", selectedAgent === agent.agentId && "bg-primary text-primary-foreground")}
            onClick={() => handleAgentSelect(agent.agentId)}
            disabled={isLoading}
          >
            <Bot className="h-4 w-4" />
            {agent.name}
            {agent.state === 'RUNNING' && (
              <div className="w-2 h-2 rounded-full bg-success" />
            )}
          </Button>
        ))}
      </div>

      {/* Main Interface */}
      <Card className="mx-auto max-w-3xl">
        <CardContent className="pt-6">
          <div className="space-y-4">
            {selectedAgent ? (
              <>
                {/* Agent Chat Interface */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h2 className="text-lg font-semibold">{selectedAgentData?.name}</h2>
                    {selectedAgentData?.state === 'RUNNING' && (
                      <span className="text-xs text-muted-foreground">(Active)</span>
                    )}
                  </div>
                  
                  {selectedAgentData?.instructions && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground">{selectedAgentData.instructions}</p>
                    </div>
                  )}

                  {llmConfig?.model && (
                    <div className="text-xs text-muted-foreground">
                      Model: {llmConfig.model}
                    </div>
                  )}

                  {selectedAgentData?.nodes && selectedAgentData.nodes.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      Tools: {selectedAgentData.nodes.join(", ")}
                    </div>
                  )}

                  <div className="min-h-[200px] max-h-[400px] overflow-y-auto border rounded-lg p-4">
                    {/* Chat messages will go here */}
                    {isLoading ? (
                      <div className="flex justify-center items-center h-full">
                        <Skeleton className="h-4 w-32" />
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="min-h-[80px]"
                      disabled={isLoading || selectedAgentData?.state !== 'RUNNING'}
                    />
                    <Button 
                      className="self-end" 
                      size="icon"
                      onClick={handleSendMessage}
                      disabled={isLoading || !message.trim() || selectedAgentData?.state !== 'RUNNING'}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold text-center mb-8">What can I help with?</h1>

                {/* Mode Toggle */}
                <div className="flex justify-center mb-6">
                  <ToggleGroup type="single" value={mode} onValueChange={(value: Mode) => value && setMode(value)}>
                    <ToggleGroupItem value="research" aria-label="Research Mode">
                      <Globe className="h-4 w-4 mr-2" />
                      Research
                    </ToggleGroupItem>
                    <ToggleGroupItem value="reason" aria-label="Reason Mode">
                      <Brain className="h-4 w-4 mr-2" />
                      Reason
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Input Section */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-3 text-muted-foreground">
                      {mode === "research" ? (
                        <Globe className="h-4 w-4" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                    </div>
                    <Input 
                      className="pl-9" 
                      placeholder={mode === "research" ? "Search the web..." : "Ask me to reason about anything..."}
                    />
                  </div>
                  <Button>
                    {mode === "research" ? (
                      <>
                        <Search className="h-4 w-4 mr-2" />
                        Search
                      </>
                    ) : (
                      <>
                        <Brain className="h-4 w-4 mr-2" />
                        Reason
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

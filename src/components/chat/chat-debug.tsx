import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { BugIcon, Loader2, RefreshCwIcon } from 'lucide-react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { templates } from '@/generated/templates';
import { useMediaQuery } from '@/hooks/use-media-query';
import { SessionInfoData, useSessionInfo } from '@/hooks/use-session-info';
import { cn } from '@/lib/utils';

interface OrchestrationStep {
  name: string;
  description: string;
  sequence?: string[];
  isDefault?: boolean;
}

interface Orchestration {
  description: string;
  steps: OrchestrationStep[];
}

interface AgentTemplate {
  orchestration?: Orchestration;
  tools?: string[];
}

interface ChatDebugProps {
  visible: boolean;
  sessionId?: string;
  messagesCount: number;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  agentId?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  provider?: string;
  activeStep?: string;
  currentStepIndex?: number;
  totalSteps?: number;
}

// Wrap the component definition with React.memo
export const ChatDebug = React.memo<ChatDebugProps>(
  ({
    visible,
    sessionId = '',
    messagesCount,
    model = '',
    temperature = 0,
    maxTokens = 0,
    agentId = '',
    promptTokens,
    completionTokens,
    totalTokens,
    provider,
    activeStep,
    currentStepIndex,
    totalSteps
  }: ChatDebugProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [debugButtonContainer, setDebugButtonContainer] =
      useState<HTMLElement | null>(null);
    const isMobile = useMediaQuery('(max-width: 640px)');

    // Restore history settings state and effect
    const [historySettings, setHistorySettings] = useState<{
      policy?: string;
      length?: number;
      source?: string;
    }>({});

    // Get history settings from window object
    useEffect(() => {
      if (typeof window !== 'undefined') {
        const policy = (window as any).ENV_HISTORY_POLICY;
        const length = (window as any).ENV_HISTORY_LENGTH;

        let source = 'default';

        if (
          process.env.NEXT_PUBLIC_DEFAULT_HISTORY_POLICY ||
          process.env.NEXT_PUBLIC_DEFAULT_HISTORY_LENGTH
        ) {
          source = 'environment';
        }

        const params = new URLSearchParams(window.location.search);
        const urlPolicy = params.get('historyPolicy');
        const urlLength = params.get('historyLength');

        if (
          (urlPolicy && urlPolicy === policy) ||
          (urlLength && parseInt(urlLength, 10) === length)
        ) {
          source = 'URL';
        }

        setHistorySettings({
          policy,
          length,
          source
        });
      }
    }, []);
    // End Restore history settings state and effect

    // Use the session info hook
    const {
      sessionData: fetchedState,
      isLoading: isLoadingUsage,
      error: fetchError,
      refresh: fetchSessionUsage
    } = useSessionInfo(sessionId);

    // Find the debug button container element
    useEffect(() => {
      const container = document.getElementById('debug-button-container');
      if (container) {
        setDebugButtonContainer(container);
      }
      return () => setDebugButtonContainer(null);
    }, []);

    // If visibility changes, update state
    useEffect(() => {
      if (!visible && isOpen) {
        setIsOpen(false);
      }
    }, [visible, isOpen]);

    // Fetch data when the sheet opens
    useEffect(() => {
      if (isOpen) {
        fetchSessionUsage();
      }
    }, [isOpen, fetchSessionUsage]);

    if (!visible) return null;

    // Get agent orchestration information if available
    const agentTemplate = agentId
      ? (templates[
          agentId as keyof typeof templates
        ] as unknown as AgentTemplate)
      : undefined;
    const orchestrationInfo = agentTemplate?.orchestration;
    const availableTools = agentTemplate?.tools || [];

    // Create the debug button element
    const debugButton = (
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(true)}
        className="h-8 w-8 relative"
        title="Debug Information"
      >
        <BugIcon className="h-4 w-4" />
      </Button>
    );

    // Determine sheet position based on screen size
    const sheetSide = isMobile ? 'bottom' : 'right';

    return (
      <>
        {/* Render debug button in the header if container is available, otherwise fixed position */}
        {debugButtonContainer ? (
          createPortal(debugButton, debugButtonContainer)
        ) : (
          <div className="fixed bottom-20 right-4 z-50">{debugButton}</div>
        )}

        {/* Debug Sheet */}
        <Sheet
          open={isOpen}
          onOpenChange={setIsOpen}
        >
          <SheetContent
            side={sheetSide}
            className={cn(
              'w-full',
              isMobile ? 'h-[70vh] rounded-t-lg border-t' : 'sm:max-w-md',
              'flex flex-col'
            )}
            onInteractOutside={() => setIsOpen(false)}
            onEscapeKeyDown={() => setIsOpen(false)}
          >
            <SheetHeader className="text-left border-b pb-4">
              <SheetTitle>Debug Information</SheetTitle>
              <SheetDescription className="text-xs">
                Details about the current chat session
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto space-y-6 p-4">
              {/* Session Info */}
              <DebugSection title="Session">
                <DebugItem
                  label="Session ID"
                  value={fetchedState?.sessionId || sessionId || 'N/A'}
                />
                <DebugItem
                  label="Messages"
                  value={messagesCount.toString()}
                />
              </DebugSection>

              {/* Model Configuration */}
              <DebugSection title="Model Config">
                <DebugItem
                  label="Provider"
                  value={provider || 'N/A'}
                />
                <DebugItem
                  label="Model"
                  value={model || 'N/A'}
                />
                <DebugItem
                  label="Temperature"
                  value={temperature?.toString() ?? 'N/A'}
                />
                <DebugItem
                  label="Max Tokens"
                  value={maxTokens?.toString() ?? 'N/A'}
                />
              </DebugSection>

              {/* Cumulative Session Usage */}
              <DebugSection title="Cumulative Session Usage">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-medium">Session Token Usage</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchSessionUsage}
                    disabled={isLoadingUsage || !sessionId}
                    className="h-7 px-2"
                  >
                    {isLoadingUsage ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="h-3 w-3" />
                    )}
                    <span className="ml-1">Refresh</span>
                  </Button>
                </div>
                {isLoadingUsage && (
                  <div className="text-sm text-muted-foreground italic">
                    Loading usage...
                  </div>
                )}
                {fetchError && (
                  <div className="text-sm text-destructive">
                    Error: {fetchError}
                  </div>
                )}
                {!isLoadingUsage &&
                  !fetchError &&
                  fetchedState?.cumulativeTokenUsage && (
                    <div className="font-mono text-sm bg-muted p-2 rounded space-y-1">
                      <div>
                        Prompt Tokens:{' '}
                        {fetchedState.cumulativeTokenUsage.promptTokens}
                      </div>
                      <div>
                        Completion Tokens:{' '}
                        {fetchedState.cumulativeTokenUsage.completionTokens}
                      </div>
                      <div className="font-semibold">
                        Total Tokens:{' '}
                        {fetchedState.cumulativeTokenUsage.totalTokens}
                      </div>
                    </div>
                  )}
                {!isLoadingUsage &&
                  !fetchError &&
                  !fetchedState?.cumulativeTokenUsage && (
                    <div className="text-sm text-muted-foreground italic">
                      No usage data available.
                    </div>
                  )}
              </DebugSection>

              {/* Restore History Settings Section */}
              <DebugSection title="History Settings">
                <DebugItem
                  label="Policy"
                  value={historySettings.policy || 'lastN'}
                />
                <DebugItem
                  label="Length"
                  value={historySettings.length?.toString() ?? '20'}
                />
                <DebugItem
                  label="Source"
                  value={historySettings.source || 'default'}
                />
              </DebugSection>

              {/* Orchestration Info - Enhanced to show more details */}
              {orchestrationInfo && (
                <DebugSection title="Agent Orchestration">
                  <div className="text-[10px] text-muted-foreground mb-1">
                    {orchestrationInfo.description}
                  </div>
                  <h4 className="text-[10px] font-medium mt-1 mb-0.5">
                    Available Steps:
                  </h4>
                  <ul className="list-disc pl-4 space-y-2 text-[10px]">
                    {orchestrationInfo.steps.map((step, index) => (
                      <li
                        key={index}
                        className={cn('pb-1', step.isDefault && 'font-medium')}
                      >
                        <div className="text-[10px]">{step.name}</div>
                        <div className="text-[10px] text-muted-foreground ml-2">
                          {step.description}
                        </div>
                        {step.sequence && step.sequence.length > 0 && (
                          <div className="ml-2 mt-0.5">
                            <span className="text-[9px] text-muted-foreground">
                              Sequence:{' '}
                            </span>
                            <span className="text-[9px] font-mono">
                              {step.sequence.join(' → ')}
                            </span>
                          </div>
                        )}
                        {step.isDefault && (
                          <div className="text-[9px] text-green-600 mt-0.5 ml-2">
                            Default Step
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </DebugSection>
              )}

              {/* Tool Info */}
              {availableTools.length > 0 && (
                <DebugSection title="Tools">
                  <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                    {availableTools.map((tool, index) => (
                      <li key={index}>{tool}</li>
                    ))}
                  </ul>
                </DebugSection>
              )}

              {/* Active Step - Moved to end of the panel */}
              {(activeStep || fetchedState?.activeStep) && (
                <DebugSection title="Current Orchestration Step">
                  <DebugItem
                    label="Active Step"
                    value={activeStep || fetchedState?.activeStep || 'N/A'}
                  />
                  {currentStepIndex !== undefined &&
                    totalSteps !== undefined && (
                      <DebugItem
                        label="Progress"
                        value={`${currentStepIndex}/${totalSteps}`}
                      />
                    )}
                  {fetchedState?.recentlyUsedTools &&
                    fetchedState.recentlyUsedTools.length > 0 && (
                      <>
                        <h4 className="text-[10px] font-medium mt-2 mb-0.5">
                          Recent Tools:
                        </h4>
                        <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                          {fetchedState.recentlyUsedTools.map((tool, index) => (
                            <li key={index}>{tool}</li>
                          ))}
                        </ul>
                      </>
                    )}
                </DebugSection>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </>
    );
  }
);

// Assign display name for React DevTools
ChatDebug.displayName = 'ChatDebug';

// Handle default export for dynamic import
export default ChatDebug;

// Helper components
interface DebugSectionProps {
  title: string;
  children: React.ReactNode;
}

function DebugSection({ title, children }: DebugSectionProps) {
  return (
    <div>
      <h3 className="text-sm font-semibold mb-2 border-b pb-1">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

interface DebugItemProps {
  label: string;
  value: string;
  copyable?: boolean;
}

function DebugItem({ label, value, copyable = false }: DebugItemProps) {
  const handleCopy = () => {
    navigator.clipboard
      .writeText(value)
      .then(() => toast.success(`${label} copied to clipboard!`))
      .catch(() => toast.error(`Failed to copy ${label}`));
  };

  return (
    <div className="flex justify-between items-start text-xs">
      <span className="text-muted-foreground mr-2">{label}:</span>
      <div className="flex items-center gap-1 text-right break-all">
        <span className="font-mono">{value}</span>
        {copyable && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-5 w-5 shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="w-3 h-3"
            >
              <path
                fillRule="evenodd"
                d="M4.25 2A2.25 2.25 0 0 0 2 4.25v8.5A2.25 2.25 0 0 0 4.25 15h4.5a.75.75 0 0 0 0-1.5h-4.5a.75.75 0 0 1-.75-.75v-8.5a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 .75.75v2a.75.75 0 0 0 1.5 0v-2A2.25 2.25 0 0 0 8.25 2h-4Zm4 2a.75.75 0 0 1 .75.75v2.25H11a.75.75 0 0 1 .75.75v4a.75.75 0 0 1-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4a.75.75 0 0 1 .75-.75h2.25V4.75a.75.75 0 0 1 .75-.75Zm.75 5.75V9h-1.5v1.5h1.5Z"
                clipRule="evenodd"
              />
              <path d="M10.75 1A2.25 2.25 0 0 1 13 3.25v8.5A2.25 2.25 0 0 1 10.75 14h-4.5a.75.75 0 0 1 0-1.5h4.5a.75.75 0 0 0 .75-.75v-8.5a.75.75 0 0 0-.75-.75h-4a.75.75 0 0 0-.75.75v2a.75.75 0 0 1-1.5 0v-2A2.25 2.25 0 0 1 6.25 1h4.5Z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  );
}

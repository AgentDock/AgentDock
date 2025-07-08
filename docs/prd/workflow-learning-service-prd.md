# Workflow Learning Service - PRD

**Author**: AgentDock Team  
**Date**: July 2025  
**Status**: Implementation Ready  
**Purpose**: Implement intelligent tool workflow learning and execution

---

## Executive Summary

Unify and enhance AgentDock's existing workflow learning capabilities by creating a consolidated service that captures, learns, and executes multi-step tool sequences. The system will build upon mature procedural learning infrastructure already in production to enable deterministic replay of complex workflows and support user-submitted workflow definitions.

## Problem Statement

**Business Need**:
- Agents repeatedly execute the same multi-step tool sequences for similar tasks
- Existing tool pattern learning lacks execution capabilities for deterministic replay
- Complex workflows (15+ steps) can be learned but not automatically executed
- No unified interface for both auto-learned and user-submitted workflow automation

**Technical Challenge**:
- Two separate procedural systems exist with different purposes and naming confusion:
  - `ProceduralMemory` (memory type) - stores simple trigger→action patterns  
  - `ProceduralMemoryManager` (service) - learns tool sequence patterns
- Must be unified into a single, coherent workflow learning and execution system

## Solution Architecture

### Core Concept: Enhanced Workflow Learning & Execution

Building on AgentDock's existing procedural learning foundation, the system provides complete workflow automation:

1. **Pattern Detection** (EXISTING) - Already identifies repeated tool sequences and tracks success rates
2. **Workflow Storage** (EXISTING) - Currently stores patterns in procedural memory with user isolation  
3. **Smart Execution** (NEW) - Add deterministic replay engine for learned workflows
4. **User Workflows** (NEW) - Add manual workflow definition and submission capabilities
5. **Unified Architecture** (NEW) - Consolidate existing systems into coherent service

### Service Architecture
```
/agentdock-core/src/orchestration/workflow-learning/
├── WorkflowLearningService.ts     # Core learning and execution service
├── WorkflowLearningTypes.ts       # Workflow data structures
├── index.ts                       # Service exports
└── __tests__/
    └── WorkflowLearningService.test.ts
```

### Integration Flow

```typescript
// Clean separation of concerns
WorkflowLearningService  // Service that learns workflows
    ↓ stores patterns in
ProceduralMemory        // Memory type that stores patterns
    ↓ uses
Storage Layer           // Existing storage with user isolation
```

## Core Features

### Automatic Workflow Learning

The service automatically detects and learns tool execution patterns:

- **Pattern Recognition** - Identifies successful tool sequences (3+ steps)
- **Success Tracking** - Monitors execution outcomes and performance metrics
- **Confidence Scoring** - Builds confidence based on repeated successful execution
- **Context Awareness** - Associates workflows with execution contexts

### User-Submitted Workflows

Support for manually defined workflows:

- **Workflow Definition** - Define multi-step tool sequences via API
- **Parameter Templates** - Configurable parameters for flexible execution
- **Validation** - Ensure workflow steps are valid and executable
- **Priority Handling** - User workflows take precedence over auto-learned patterns

### Deterministic Execution

Reliable replay of learned workflows:

- **Step-by-Step Execution** - Execute workflows in defined order
- **Error Handling** - Graceful failure recovery and partial execution
- **Progress Tracking** - Real-time execution progress reporting
- **Performance Metrics** - Track execution time and success rates

## Implementation

### WorkflowLearningService
```typescript
// /orchestration/workflow-learning/WorkflowLearningService.ts
export class WorkflowLearningService {
  constructor(
    private proceduralMemory: ProceduralMemory,  // Uses the actual memory type
    private config: WorkflowLearningConfig
  ) {}

  async learnToolWorkflow(data: ToolExecutionData): Promise<void> {
    const { userId, agentId, toolSequence, success, context } = data;
    
    if (toolSequence.length >= this.config.minStepsToLearn) {
      const workflowPattern = this.extractWorkflowPattern(toolSequence, context);
      
      // Store in ACTUAL procedural memory (not confusing fake memory manager)
      await this.proceduralMemory.store(userId, agentId, {
        trigger: workflowPattern.description,
        action: JSON.stringify(workflowPattern.steps),
        pattern: workflowPattern.signature,
        confidence: success ? 0.8 : 0.3,
        metadata: {
          category: 'tool-workflow',
          source: 'auto-learned',
          toolSequence: workflowPattern.steps.map(s => s.toolName)
        }
      });
    }
  }

  async findWorkflow(userId: string, agentId: string, context: string): Promise<ToolWorkflow | null> {
    // Query ACTUAL procedural memory for tool workflows
    const patterns = await this.proceduralMemory.recall(userId, agentId, context, {
      metadata: { category: 'tool-workflow' },
      minConfidence: 0.7
    });
    
    return this.selectBestWorkflow(patterns);
  }

  async submitUserWorkflow(userId: string, agentId: string, workflow: UserWorkflow): Promise<void> {
    // Store user workflow in ACTUAL procedural memory
    await this.proceduralMemory.store(userId, agentId, {
      trigger: workflow.description,
      action: JSON.stringify(workflow.steps),
      pattern: `user-workflow:${workflow.name}`,
      confidence: 1.0,
      metadata: {
        category: 'tool-workflow',
        source: 'user-submitted',
        workflowName: workflow.name
      }
    });
  }
}
```

#### Integration with LLMOrchestrationService
```typescript
// Clean integration in LLMOrchestrationService
export class LLMOrchestrationService {
  private workflowLearningService: WorkflowLearningService;

  constructor(/*...*/) {
    // Initialize workflow learning service with actual procedural memory
    const proceduralMemory = this.memoryManager.getProceduralMemory();
    this.workflowLearningService = new WorkflowLearningService(proceduralMemory, config);
  }

  async handleStepFinish(event: StepFinishEvent): Promise<void> {
    // Existing tool tracking logic...
    
    // Add workflow learning
    if (this.config.workflowLearning?.enabled && toolNamesFound) {
      const executionData = {
        userId: this.sessionContext.userId,
        agentId: this.sessionContext.agentId,
        toolSequence: this.getSessionTools(),
        success: this.evaluateSuccess(event),
        context: this.getExecutionContext()
      };
      
      // Learn workflow patterns (async, non-blocking)
      this.workflowLearningService.learnToolWorkflow(executionData).catch(error => {
        console.warn('Workflow learning failed:', error);
      });
    }
  }
}
```

### Data Structures (Clean Naming)

```typescript
// /orchestration/workflow-learning/WorkflowLearningTypes.ts

interface ToolWorkflow {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggerKeywords: string[];
  source: 'auto-learned' | 'user-submitted';
  confidence: number;
  successCount: number;
  totalExecutions: number;
  createdAt: number;
  lastUsed: number;
}

interface WorkflowStep {
  order: number;
  toolName: string;
  parameters: Record<string, any>;
  required: boolean;
  description?: string;
}

interface UserWorkflow {
  name: string;
  description: string;
  steps: WorkflowStep[];
  triggerKeywords: string[];
}

interface ToolExecutionData {
  userId: string;
  agentId: string;
  toolSequence: Array<{
    toolName: string;
    parameters: Record<string, any>;
    duration: number;
    success: boolean;
  }>;
  success: boolean;
  context: string;
}

interface WorkflowLearningConfig {
  enabled: boolean;
  minStepsToLearn: number;        // Default: 3
  minSuccessRate: number;         // Default: 0.6
  confidenceThreshold: number;    // Default: 0.8
  maxWorkflowsPerAgent: number;   // Default: 1000
  learningTimeout: number;        // Default: 100ms
}
```

### Storage Strategy (Uses Existing System)

**NO new storage patterns needed** - uses existing procedural memory:

```typescript
// Workflow patterns stored as procedural memory data
await proceduralMemory.store(userId, agentId, {
  trigger: "Code review workflow",
  action: JSON.stringify([
    { order: 1, toolName: "Bash", parameters: { command: "git diff main" } },
    { order: 2, toolName: "Grep", parameters: { pattern: "TODO|FIXME" } },
    { order: 3, toolName: "Bash", parameters: { command: "npm test" } }
  ]),
  pattern: "code-review-workflow",
  confidence: 0.85,
  metadata: {
    category: 'tool-workflow',
    source: 'auto-learned',
    toolSequence: ['Bash', 'Grep', 'Bash']
  }
});
```

**User isolation** handled by existing procedural memory operations.

### API Design (Clean)

```typescript
// POST /api/workflows - User workflow submission
export async function POST(request: Request) {
  const { userId, agentId, workflow } = await request.json();
  
  // User authentication (application responsibility)
  const authenticatedUserId = await extractUserFromRequest(request);
  if (!authenticatedUserId || authenticatedUserId !== userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Use workflow learning service
  const workflowLearningService = await getWorkflowLearningService();
  await workflowLearningService.submitUserWorkflow(userId, agentId, workflow);
  
  return Response.json({ success: true });
}

// GET /api/workflows - List workflows
export async function GET(request: Request) {
  const { userId, agentId } = extractParams(request);
  
  const workflowLearningService = await getWorkflowLearningService();
  const workflows = await workflowLearningService.getWorkflows(userId, agentId);
  
  return Response.json({ workflows });
}
```

## Implementation Phases

### Phase 1: Service Consolidation (IMMEDIATE ACTION)
- **MOVE**: Rename `/memory/procedural/ProceduralMemoryManager.ts` → `/orchestration/workflow-learning/WorkflowLearningService.ts`
- **UNIFY**: Integrate existing tool pattern learning with procedural memory type storage
- **CLEAN**: Eliminate naming confusion between memory type and service
- **UPDATE**: Fix all imports and references (minimal impact - only 2 files affected)

### Phase 2: Learning Integration (MOSTLY COMPLETE)
- **EXISTING**: WorkflowLearningService already tracks tool execution patterns
- **EXISTING**: Automatic pattern detection from successful tool sequences  
- **EXISTING**: Workflow storage using procedural memory operations
- **EXISTING**: Workflow matching and suggestion algorithms
- **NEEDED**: Connect to LLMOrchestrationService for real-time integration

### Phase 3: Execution Engine (PRIMARY DEVELOPMENT)
- **NEW**: Build deterministic workflow execution with error handling
- **NEW**: Implement user workflow submission API endpoints  
- **NEW**: Add partial execution and recovery mechanisms
- **NEW**: Create workflow performance tracking and metrics

### Phase 4: Production Enhancement
- **EXISTING**: Performance optimized using memory system capabilities
- **NEW**: Add execution testing beyond existing pattern learning tests
- **NEW**: Implement workflow execution analytics and reporting  
- **NEW**: Deploy unified workflow learning and execution system

## Success Metrics

### Learning Effectiveness
- **90%** accuracy in workflow pattern recognition
- **95%** success rate for learned workflows  
- **70%** reduction in execution time for repeated tasks
- **85%** of multi-step tasks automated through learned workflows

### System Performance
- **<5ms** overhead for workflow learning during tool execution
- **<100ms** workflow lookup and matching using existing memory operations
- **<200ms** workflow execution startup time
- **No impact** on existing memory system performance

### User Experience
- **80%** of users find workflow suggestions helpful
- **60%** adoption rate for suggested workflows
- **50%** of agents use learned workflows within 30 days
- **95%** reliability score for workflow execution

## Risk Mitigation

### Technical Risks
- **Integration complexity**: Minimized by using existing procedural memory infrastructure
- **Performance impact**: Controlled through async learning and efficient memory queries
- **Storage bloat**: Managed through existing memory decay and importance scoring

### Business Risks
- **False workflow triggers**: High confidence thresholds prevent unwanted execution
- **Workflow conflicts**: Clear priority system (user-submitted > auto-learned)
- **Execution failures**: Graceful degradation and partial execution support

## Conclusion

The Workflow Learning Service delivers intelligent automation by learning from successful tool execution patterns and enabling deterministic replay of complex workflows. By building on AgentDock's existing procedural memory infrastructure and proven user isolation patterns, the system provides:

- **Automatic Learning** - Captures successful multi-step tool sequences without manual intervention
- **Deterministic Execution** - Reliable replay of complex workflows with consistent results  
- **User Control** - Support for manually defined workflows with priority over auto-learned patterns
- **Seamless Integration** - Uses existing memory system for storage with proven performance characteristics

The service transforms agents from reactive tool users into proactive workflow executors, building institutional knowledge that improves over time while maintaining the flexibility and reliability that makes AgentDock powerful.
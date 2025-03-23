# Compare Tool

The Compare Tool is a powerful cognitive enhancement that provides structured comparison capabilities. Unlike traditional tools that access external APIs, the Compare Tool operates entirely within the agent's reasoning capabilities, enabling sophisticated, nuanced comparison of multiple options, concepts, or approaches.

## Overview

The Compare Tool creates a dedicated workspace for the model to:

1. Define the items being compared and establish context
2. Identify appropriate criteria for meaningful evaluation
3. Analyze options across multiple dimensions
4. Highlight key differences and similarities
5. Explore situational trade-offs and context-specific considerations
6. Conclude with recommendations or decision guidance

## Usage

The Compare Tool can be added to any agent by including `compare` in the agent's tool list:

```json
{
  "tools": ["compare", "think", "search"]
}
```

Once configured, the agent can use the Compare Tool to perform detailed comparative analysis, with output formatted in a visually distinct component.

### Example Agent Prompt

When using an agent with the Compare Tool, you can explicitly instruct it to use structured comparison:

```
For complex decisions between multiple options, use the 'compare' tool to create 
a systematic analysis highlighting key differences, trade-offs, and contextual considerations.
```

## Implementation Details

The Compare Tool is implemented with these key components:

1. **Core Schema**: Structured parameter definition for the topic and comparison content
2. **Execution Logic**: Processing the comparison with immediate feedback for partial parameters
3. **Component Rendering**: Visual presentation with enhanced Markdown formatting and tables
4. **Loading Animation**: Visual indicator during processing

## Output Example

When the Compare Tool is used, it produces output like this:

```
🔍 Comparing: Serverless vs. Container-based Architectures

**DEFINE:** 
This analysis examines two cloud-native application deployment models: serverless computing (like AWS Lambda, Azure Functions) and container-based architectures (like Kubernetes, Docker Swarm).

**CRITERIA:**
1. Cost model
2. Scalability characteristics
3. Development complexity
4. Operational overhead
5. Performance characteristics
6. Vendor lock-in considerations

**ANALYSIS:**

| Aspect | Serverless | Containers |
| --- | --- | --- |
| Cost Model | Pay-per-execution, idle time not billed | Pay for allocated resources regardless of usage |
| Scaling | ✓ Automatic, instant scaling | ✓ Highly scalable but requires configuration |
| Cold Start | ✗ Latency issues for infrequent requests | ✓ No cold start problem |
| Resource Limits | ✗ Restricted execution time/memory | ✓ Configurable resource allocation |
| State Management | ✗ Primarily stateless, external storage needed | ✓ Easier stateful applications |
| DevOps Complexity | ✓ Minimal infrastructure management | ✗ Container orchestration complexity |

**STRENGTHS & WEAKNESSES:**

Serverless Strengths:
1. Zero server management
2. Automatic scaling with no configuration
3. Reduced operational costs for variable workloads
4. Simplified deployment process

Serverless Weaknesses:
1. Cold start latency
2. Limited execution duration
3. Complex debugging and testing
4. Potential vendor lock-in

Container Strengths:
1. Consistent environments across development and production
2. Better support for long-running processes
3. More control over infrastructure
4. Portable across different cloud providers

Container Weaknesses:
1. Requires cluster management expertise
2. More complex deployment pipelines
3. Capacity planning challenges
4. Potential resource wastage

**TRADE-OFFS:**
The choice between serverless and containers involves key trade-offs between operational simplicity and control. Serverless architectures eliminate infrastructure management but sacrifice control and flexibility. Container-based approaches provide greater control but introduce operational complexity.

**CONCLUDE:**
Serverless is ideal for:
- Event-driven, intermittent workloads
- Rapid development and deployment needs
- Teams without DevOps expertise
- Startups with limited operational resources

Containers are better suited for:
- Predictable, steady-state workloads
- Applications requiring specific runtime dependencies
- Workloads with performance sensitivity
- Organizations with existing container expertise

Hybrid approaches using both models for different application components may offer the best balance for complex systems.
```

## Flexible Structure

The Compare Tool adapts its comparison approach based on the topic type, allowing for:

- **Product comparisons**: Focus on features, performance, use cases, and value
- **Methodology comparisons**: Analyze approaches, underlying philosophies, and outcomes
- **Theoretical comparisons**: Examine foundational principles, implications, and applications
- **Historical comparisons**: Contrast contexts, impacts, and interpretations
- **Decision analysis**: Evaluate trade-offs, constraints, and potential outcomes

This flexibility ensures the comparison matches the specific requirements of the topic rather than forcing every analysis into the same rigid template.

## Styling

The Compare Tool uses shared CSS styles that provide:

- Visual distinction for the comparison component
- Table formatting for side-by-side analysis
- Highlighting for differences and similarities
- Icons for strengths (✓) and weaknesses (✗)
- Dark mode support

## Prompting Patterns

These patterns work well with the Compare Tool:

### Standard Compare Framework
"Compare [option A] and [option B], analyzing their key differences, strengths, weaknesses, and best use cases."

### Feature Analysis Pattern
"Create a detailed comparison of [product A] vs [product B], focusing on features, performance, price, and user experience."

### Decision Support Pattern
"Analyze the pros and cons of [approach A] vs [approach B] for [specific situation], including trade-offs and recommendations."

### Technology Evaluation Pattern
"Compare [technology A] and [technology B] for building [specific application], considering scalability, maintenance, learning curve, and community support."

## Cognitive Tools Suite

This tool is part of the cognitive tools suite that includes:

- **Think Tool**: Structured reasoning for complex problem-solving
- **Reflect Tool**: Retrospective analysis and insight extraction
- **Compare Tool**: Systematic comparison between options
- **Critique Tool**: Critical evaluation with actionable suggestions
- **Debate Tool**: Multi-perspective reasoning with opposing viewpoints
- **Brainstorm Tool**: Creative ideation with structured categorization 
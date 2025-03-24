# Debate Tool

## Overview

The Debate Tool is a cognitive enhancement that provides multi-perspective analysis for complex or controversial topics. Unlike many tools that require external API calls, the Debate Tool functions entirely within the agent's reasoning capabilities, enabling rich, nuanced exploration of different viewpoints on a given topic.

## Usage

The Debate Tool can be integrated into any agent by adding `"debate"` to the agent's tool list in JSON format.

**Example Agent Prompt:**

```
When faced with complex or controversial topics, use the Debate Tool to explore multiple perspectives. 
For balanced analysis:
1. First acknowledge the topic's complexity
2. Call the debate tool with the topic
3. Present 3-4 diverse perspectives fairly
4. Highlight areas of potential agreement or compromise
5. Conclude with a balanced assessment
```

## Implementation Details

### Core Schema

The Debate Tool accepts these parameters:
- `topic` (required): A description of the complex or controversial topic to analyze
- `perspectives` (optional): Multi-perspective analysis with arguments from different viewpoints

### Execution Logic

When the tool receives only a topic (partial call), it dynamically generates a structured debate using the LLM context. The AI adapts its analytical approach based on the topic type, choosing the most appropriate structure rather than following a rigid template. For complete calls with pre-defined perspectives, it formats and returns the analysis directly.

### Component Rendering

The debate is rendered with enhanced Markdown formatting:
- Section headers are styled for visual hierarchy
- Perspectives are clearly delineated
- Arguments, counter-arguments, and evidence are distinctly formatted

### Loading Animation

While generating content, the tool displays a subtle loading animation, providing visual feedback during longer processes.

## Output Example

```markdown
## ⚖️ Debate on: Universal Basic Income

**INTRODUCTION:**
Universal Basic Income (UBI) represents a policy proposal where governments provide regular payments to all citizens regardless of their employment status or income level. The concept has gained attention as automation, wealth inequality, and evolving economic models challenge traditional employment and safety net structures.

### PERSPECTIVE 1: Economic Freedom Advocate

**ARGUMENTS:**
1. UBI would provide economic freedom, allowing individuals to pursue education, entrepreneurship, or creative endeavors without financial pressure
2. It could reduce bureaucracy by replacing complex welfare systems with a single, streamlined payment
3. Consumer spending would increase, potentially stimulating economic growth from the bottom up

**COUNTER-ARGUMENTS:**
1. The cost would be prohibitively expensive for most government budgets
2. It might reduce work incentives, potentially decreasing overall productivity
3. Inflation could negate benefits if not implemented carefully

**EVIDENCE:**
- The Alaska Permanent Fund has provided universal dividends since 1982 without negative workforce impacts
- Finland's UBI experiment (2017-2018) showed improved well-being but minimal employment effects
- Roosevelt Institute models suggest economic growth potential through increased consumer spending

### PERSPECTIVE 2: Social Welfare Proponent

...additional perspectives with their arguments, counter-arguments, and evidence...

### **SYNTHESIS:**
Areas of potential agreement include the need to address growing economic inequality, the challenge of technological displacement, and the value of reducing poverty. Both UBI supporters and critics acknowledge that implementation details matter significantly—including funding mechanisms, payment amounts, and complementary policies.

**CONCLUSION:**
While universal basic income represents a bold approach to economic security, the most viable path forward may involve targeted pilots with rigorous evaluation, carefully designed funding mechanisms that avoid inflationary pressure, and complementary policies addressing education, healthcare, and housing costs. Any implementation should acknowledge regional economic differences and remain adaptable as outcomes emerge.
```

## Flexible Structure

The Debate Tool adapts its structure based on the topic type, allowing for:

- **Policy debates**: Comparing stakeholder perspectives with concerns and interests
- **Ethical dilemmas**: Exploring different ethical frameworks and their conclusions
- **Scientific controversies**: Presenting competing theories with supporting evidence
- **Historical interpretations**: Contrasting different schools of thought on events
- **Practical decisions**: Analyzing tradeoffs between different approaches

This flexibility ensures that the analysis matches the specific requirements of the topic rather than forcing every debate into the same rigid template.

## Styling

The Debate Tool uses shared CSS styles for visual distinction while maintaining consistency with other cognitive tools in the suite.

## Prompting Patterns

These patterns work well with the Debate Tool:

### Standard Debate Framework
"Present multiple perspectives on [topic], covering different viewpoints fairly and highlighting areas of potential agreement."

### Policy Analysis Pattern
"Analyze [policy] from different stakeholder perspectives, including arguments, counter-arguments, and supporting evidence for each view."

### Ethical Dilemma Pattern
"Explore the ethical dimensions of [situation] from utilitarian, deontological, virtue ethics, and care ethics perspectives."

### Scientific Controversy Pattern
"Evaluate the scientific debate around [topic], presenting evidence-based perspectives from different research traditions."

## Cognitive Tools Suite

The Debate Tool is part of a broader cognitive tools suite, which includes:

- **Think Tool**: Structured reasoning for complex problem-solving
- **Reflect Tool**: Self-evaluation and improvement through metacognition
- **Critique Tool**: Balanced critical analysis with actionable suggestions
- **Compare Tool**: Systematic comparison of multiple options or concepts
- **Debate Tool**: Multi-perspective analysis for nuanced understanding
- **Brainstorm Tool**: [Coming soon] Creative ideation with structured output

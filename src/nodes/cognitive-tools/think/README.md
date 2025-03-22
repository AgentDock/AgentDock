# Think Tool

The Think Tool is a sophisticated cognitive scaffolding tool that enhances LLM reasoning capabilities without requiring external API calls or data retrieval. It provides a structured environment for decomposing complex problems, exploring multiple solution paths, and synthesizing coherent analyses.

## Overview

Unlike traditional tools that execute external code or retrieve data, the Think Tool creates a dedicated cognitive workspace for the model to:

1. Clarify the problem and define what needs to be determined
2. Identify key variables, constraints, and unknowns
3. Consider multiple approaches and select appropriate strategies
4. Execute detailed reasoning in a step-by-step manner
5. Verify the solution and check for errors or edge cases
6. Conclude with a well-reasoned answer or recommendation

## Usage

The Think Tool can be added to any agent by including `think` in the agent's tool list:

```json
{
  "tools": ["think", "search", "deep-research"]
}
```

Once configured, the agent can use the Think Tool to enhance its reasoning on complex problems, with output formatted in a visually distinct component.

### Example Agent Prompt

When using an agent with the Think Tool, you can explicitly instruct it to use structured reasoning:

```
For complex questions, use the 'think' tool to break down your reasoning step by step.
This will help make your analysis more transparent and systematic.
```

## Implementation Details

The Think Tool is implemented with these key components:

1. **Core Schema**: Structured parameter definition with adTopic, reasoning, and confidence
2. **Execution Logic**: Processing the reasoning with immediate feedback for partial parameters
3. **Component Rendering**: Visual presentation with enhanced Markdown formatting
4. **Loading Animation**: Visual indicator during processing with styled animation

## Output Example

When the Think Tool is used, it produces output like this:

```
🧠 Thinking about: Financial Return Calculation

CLARIFY: I need to determine the annual return on investment for a property given initial cost and annual income.

IDENTIFY: 
- Initial investment: $250,000
- Annual rental income: $24,000
- Annual expenses: $6,000
- Time period: 1 year

APPROACH: I can calculate the ROI using the formula:
ROI = (Net Profit / Cost of Investment) × 100%

EXECUTE:
1. Calculate the net profit: $24,000 - $6,000 = $18,000
2. Calculate the ROI: ($18,000 / $250,000) × 100% = 7.2%

VERIFY: 
This appears reasonable for a rental property. Let me double-check:
$18,000 ÷ $250,000 = 0.072 = 7.2%

CONCLUDE: The annual return on investment for this property is 7.2%.

Confidence: 95.0%
```

## Styling

The Think Tool now uses shared CSS styles (in `components/styles.css`) that provide:

- Visual distinction for the thinking component
- Consistent styling with other cognitive tools
- Highlighting for section headers and numbered steps
- Emphasis on conclusion statements
- Confidence indicator formatting
- Dark mode support

## Prompting Patterns

The tool works best with specific reasoning structures:

1. **CLARIFY-IDENTIFY-APPROACH-EXECUTE-VERIFY-CONCLUDE**: The standard reasoning framework
2. **Multi-Perspective Analysis**: Exploring a problem from different viewpoints
3. **Decision Matrix Framework**: Evaluating options against defined criteria

## Cognitive Tools Suite

This tool is part of the cognitive tools suite that includes:

- **Think Tool**: Structured reasoning for complex problem-solving
- **Reflect Tool**: Retrospective analysis and insight extraction
- **Compare Tool**: (Planned) Systematic comparison between options
- **Critique Tool**: (Planned) Critical evaluation of arguments or code
- **Brainstorm Tool**: (Planned) Divergent thinking for idea generation
- **Debate Tool**: (Planned) Multi-perspective reasoning with opposing viewpoints 
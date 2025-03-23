# Critique Tool

The Critique Tool is a sophisticated analytical tool that enhances LLM critical analysis without requiring external API calls or data retrieval. It provides a structured framework for identifying strengths, weaknesses, and opportunities for improvement in various contexts, from code and writing to arguments and designs.

## Overview

The Critique Tool creates a dedicated workspace for the model to:

1. Understand the subject being critiqued
2. Identify key strengths and positive aspects
3. Highlight issues, weaknesses, and areas for improvement
4. Provide specific, actionable suggestions for enhancement
5. Evaluate the overall quality with a balanced perspective
6. Conclude with a nuanced assessment and prioritized recommendations

## Usage

The Critique Tool can be added to any agent by including `critique` in the agent's tool list:

```json
{
  "tools": ["critique", "think", "search"]
}
```

Once configured, the agent can use the Critique Tool to perform detailed critical analysis, with output formatted in a visually distinct component.

### Example Agent Prompt

When using an agent with the Critique Tool, you can explicitly instruct it to use structured critical analysis:

```
For detailed evaluation of code, writing, designs, or arguments, use the 'critique' tool 
to provide balanced, actionable feedback with specific strengths and areas for improvement.
```

## Implementation Details

The Critique Tool is implemented with these key components:

1. **Core Schema**: Structured parameter definition for the subject and analysis
2. **Execution Logic**: Processing the critique with immediate feedback for partial parameters
3. **Component Rendering**: Visual presentation with enhanced Markdown and semantic coloring
4. **Loading Animation**: Visual indicator during processing

## Output Example

When the Critique Tool is used, it produces output like this:

```
🔍 Critique of: React Component Implementation

UNDERSTANDING: This component is a form that collects user information and handles submission. It uses React hooks for state management and form validation.

STRENGTHS:
1. Good separation of concerns with validation logic extracted
2. Proper use of React hooks for state management
3. Error handling for form submission included
4. Clear variable naming convention

ISSUES:
1. Missing error handling for empty form fields
2. Form submission function is unnecessarily complex
3. No accessibility considerations (missing aria attributes)
4. State updates could cause performance issues with large forms

SUGGESTIONS:
1. Add validation for empty fields before submission
2. Refactor submission function using async/await pattern
3. Implement proper form accessibility with labels and aria attributes
4. Consider using useCallback for event handlers to prevent unnecessary rerenders

OVERALL ASSESSMENT:
The implementation is functional but has room for improvement, particularly in error handling, accessibility, and performance optimization. The code structure is good but would benefit from more robust validation and modern async patterns.
```

## Flexible Structure

The Critique Tool adapts its critique approach based on the subject type, allowing for:

- **Code critiques**: Focused on functionality, efficiency, readability, and best practices
- **Writing critiques**: Analyze clarity, structure, argumentation, and stylistic elements
- **Argument evaluations**: Evaluate logical consistency, evidence quality, and persuasiveness
- **Design reviews**: Consider usability, aesthetics, functionality, and target audience
- **Concept assessments**: Assess feasibility, originality, coherence, and potential impact

This flexibility ensures the critique matches the specific requirements of the subject rather than forcing every analysis into the same rigid template.

## Styling

The Critique Tool uses shared CSS styles (in `components/styles.css`) that provide:

- Visual distinction for the critique component
- Consistent styling with other cognitive tools
- Highlighting for strengths, issues, and suggestions
- Emphasis on the overall assessment
- Dark mode support

## Prompting Patterns

The tool works best with specific critique structures:

1. **UNDERSTANDING-STRENGTHS-ISSUES-SUGGESTIONS-ASSESSMENT**: The standard critique framework
2. **Code Review Pattern**: Focused evaluation of code quality, security, and performance
3. **Writing Critique**: Analysis of clarity, structure, and effectiveness of written content
4. **Argument Evaluation**: Examination of logical consistency and persuasiveness
5. **Design Review**: Assessment of usability, aesthetics, and functionality

## Cognitive Tools Suite

This tool is part of the cognitive tools suite that includes:

- **Think Tool**: Structured reasoning for complex problem-solving
- **Reflect Tool**: Retrospective analysis and insight extraction
- **Compare Tool**: Systematic comparison between options
- **Critique Tool**: Critical evaluation of arguments or code
- **Brainstorm Tool**: (Planned) Divergent thinking for idea generation
- **Debate Tool**: (Planned) Multi-perspective reasoning with opposing viewpoints

# Reflect Tool

The Reflect Tool is a cognitive enhancement tool designed for retrospective analysis and insight extraction. It provides a structured framework for examining past experiences, decisions, and information to derive meaningful patterns, lessons, and growth opportunities.

## Overview

The Reflect Tool enables an AI agent to step back and conduct systematic reflection on topics, through:

1. Contextual recall of relevant information or experiences
2. Observation of key patterns, anomalies, or interesting aspects
3. Extraction of meaningful insights and lessons
4. Identification of growth areas and opportunities for improvement
5. Connecting reflections to broader contexts and principles
6. Synthesizing key takeaways in actionable forms

## Usage

The Reflect Tool can be added to any agent by including `reflect` in the agent's tool list:

```json
{
  "tools": ["think", "reflect", "search"]
}
```

Once configured, the agent can use the Reflect Tool to enhance its retrospective analysis capabilities, with output formatted in a visually distinct component.

### Example Agent Prompt

When using an agent with the Reflect Tool, you can explicitly instruct it to use structured reflection:

```
For analyzing past experiences or decisions, use the 'reflect' tool to structure your retrospective thinking.
This will help extract meaningful lessons and patterns from previous information or activities.
```

## Implementation Details

The Reflect Tool is implemented with three key components:

1. **Core Schema**: Structured parameter definition for topic, reflection, and confidence
2. **Execution Logic**: Processing the reflection and applying formatting
3. **Component Rendering**: Visual presentation with styled HTML output

## Output Example

When the Reflect Tool is used, it produces output like this:

```
🔍 Reflecting on: Past Project Failures

CONTEXT: 
The last three software projects experienced significant delays...

OBSERVATIONS:
- Requirements were frequently changed mid-development
- Testing phases were consistently shortened
- Customer feedback was gathered too late in the process

INSIGHTS:
The root cause appears to be insufficient stakeholder alignment early in the project lifecycle.

GROWTH AREAS:
Implementing a more robust requirements gathering process with formal sign-off stages.

CONNECTIONS:
This aligns with established project management principles emphasizing early stakeholder engagement.

SYNTHESIS:
To improve future project outcomes, we should focus on three key areas:
1. Formalized requirements with change management processes
2. Protected testing phases with clear entry/exit criteria
3. Early and continuous customer feedback loops

Confidence: 82.5%
```

## Styling

The Reflect Tool uses shared CSS styles (in `components/styles.css`) that provide:

- Visual distinction for the reflection component
- Highlighting for insights and observations
- Special formatting for contextual sections
- Confidence indicator formatting
- Dark mode support

## Prompting Patterns

The tool works best with specific reflection patterns:

1. **Past Experience Analysis**: Examining completed tasks for lessons
2. **Decision Review Framework**: Analyzing the reasoning behind past decisions
3. **Pattern Recognition Model**: Identifying recurring themes or issues
4. **Counterfactual Reasoning**: Exploring alternative paths that could have been taken

## Cognitive Tools Suite

This tool is part of the cognitive tools suite that includes:

- **Think Tool**: Structured reasoning for complex problem-solving
- **Reflect Tool**: Retrospective analysis and insight extraction
- **Compare Tool**: (Planned) Systematic comparison between options
- **Critique Tool**: (Planned) Critical evaluation of arguments or code
- **Brainstorm Tool**: (Planned) Divergent thinking for idea generation
- **Debate Tool**: (Planned) Multi-perspective reasoning with opposing viewpoints 
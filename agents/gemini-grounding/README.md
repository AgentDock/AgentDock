# Gemini Search Grounding Agent

## Overview

This agent utilizes Google Gemini models with built-in search grounding capabilities. It automatically incorporates information from Google Search into its responses to provide accurate, up-to-date answers to factual questions.

## Features

- **Search Grounding:** Automatically uses Google Search to verify information and provide current context.
- **Factual Accuracy:** Excels at answering questions requiring current information.
- **Source Citation:** Aims to cite sources when providing grounded information (capability depends on the underlying Gemini model).
- **Powered by Gemini:** Leverages Google's latest Gemini models.

## Configuration (`template.json`)

- **`agentId`**: `gemini-grounding`
- **`name`**: `Gemini Search Grounding`
- **`description`**: `A specialized Gemini agent with search grounding for accurate, up-to-date information`
- **`tags`**: `["research", "productivity"]`
- **`personality`**: Defines the agent's behavior focused on using search grounding for accuracy.
- **`nodes`**: Configured with `llm.gemini`.
- **`nodeConfigurations`**: Sets the specific Gemini model (e.g., `gemini-1.5-flash-latest`), temperature, and importantly, enables `useSearchGrounding: true`.
- **`chatSettings`**: Includes initial messages explaining its grounding capability and example prompts.

## Use Cases

- Getting up-to-date answers to factual questions.
- Verifying current information (e.g., news, statistics, recent events).
- Researching topics where current information is crucial.

## How It Works

The agent uses the `llm.gemini` node configured with `useSearchGrounding: true`. When processing a user prompt, the Gemini model automatically performs searches via the Google Search API, incorporates the findings into its response generation process, and potentially includes citations. 
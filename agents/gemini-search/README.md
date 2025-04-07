# Gemini Web Search Tool Agent

## Overview

This agent utilizes Google Gemini models combined with an explicit web search tool (`search`). It's designed to find specific information on the web when requested or needed to answer a user's query.

## Features

- **Web Search Tool:** Explicitly uses the `search` node to query the web.
- **Information Retrieval:** Ideal for finding answers to specific questions or current facts.
- **Summarization:** Summarizes search findings clearly.
- **Powered by Gemini:** Leverages Google's Gemini models for language understanding and response generation.

## Configuration (`template.json`)

- **`agentId`**: `gemini-search`
- **`name`**: `Gemini Web Search Tool`
- **`description`**: `A specialized Gemini agent with web search capabilities for finding specific information`
- **`tags`**: `["research", "productivity"]`
- **`personality`**: Defines the agent's behavior focused on using the search tool effectively.
- **`nodes`**: Configured with `llm.gemini` and `search`.
- **`nodeConfigurations`**: Sets the specific Gemini model (e.g., `gemini-1.5-flash-latest`) and temperature. Search grounding is explicitly disabled (`useSearchGrounding: false`) as the agent relies on the dedicated `search` tool.
- **`chatSettings`**: Includes initial messages explaining its search capability and example prompts.

## Use Cases

- Finding specific information online (e.g., weather, recipes, reviews, news).
- Answering questions requiring current web data.
- Comparing information from different web sources (via multiple search calls if needed).

## How It Works

The agent uses the `llm.gemini` node to understand the user's request. If the request requires web information, the LLM calls the `search` tool node. The `search` node executes the query, returns the results, and the LLM then processes these results to formulate a final answer for the user. 
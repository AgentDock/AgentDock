# Cognitive Reasoner Agent

The Cognitive Reasoner is an advanced agent engineered to tackle complex problems by leveraging a suite of specialized cognitive tools. It excels at structured reasoning, reflection, comparison, critique, brainstorming, and debate, providing multifaceted approaches to problem-solving without relying on external data retrieval.

## Core Value: Structured Cognitive Workflows

The primary strength of the Cognitive Reasoner lies in its **orchestrated cognitive workflows**. Instead of just having tools available, it automatically activates specific sequences of tools tailored to the type of cognitive task requested. This ensures a systematic, efficient, and contextually appropriate approach to complex reasoning.

## Orchestration Modes & Tool Sequences

The agent dynamically selects an **Orchestration Mode** based on the user's query, activating a predefined sequence of its cognitive tools. This provides structure and ensures the optimal cognitive process is followed for each task type. The available modes are:

### 1. Research Mode

- **Trigger:** Queries involving information gathering, facts, or understanding a topic.
- **Goal:** To build factual understanding and extract key insights.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Ask information query
      Agent->>Agent: Activate ResearchMode
      Agent->>Agent: Use [Search] Tool
      Agent->>Agent: Use [Think] Tool
      Agent->>Agent: Use [Reflect] Tool
      Agent-->>User: Provide researched insights
  ```

### 2. Problem-Solving Mode

- **Trigger:** Questions requiring calculations, estimations, finding solutions, or planning.
- **Goal:** To analyze a problem, generate solutions, and evaluate them.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Pose a problem
      Agent->>Agent: Activate ProblemSolvingMode
      Agent->>Agent: Use [Think] Tool
      Agent->>Agent: Use [Brainstorm] Tool
      Agent->>Agent: Use [Compare] Tool
      Agent-->>User: Present evaluated solutions
  ```

### 3. Evaluation Mode

- **Trigger:** Requests for critiques, assessments, analyses, or reviews.
- **Goal:** To critically evaluate a subject from multiple angles.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Ask for evaluation/critique
      Agent->>Agent: Activate EvaluationMode
      Agent->>Agent: Use [Critique] Tool
      Agent->>Agent: Use [Debate] Tool
      Agent->>Agent: Use [Reflect] Tool
      Agent-->>User: Provide structured evaluation
  ```

### 4. Comparison Mode

- **Trigger:** Queries involving comparing options, discussing tradeoffs, or choosing between alternatives.
- **Goal:** To systematically compare items and determine the best fit or key differences.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Ask to compare options
      Agent->>Agent: Activate ComparisonMode
      Agent->>Agent: Use [Search] Tool (if needed for facts)
      Agent->>Agent: Use [Compare] Tool
      Agent->>Agent: Use [Reflect] Tool
      Agent-->>User: Provide comparative analysis
  ```

### 5. Ideation Mode

- **Trigger:** Creative challenges, brainstorming requests, seeking new ideas.
- **Goal:** To generate and refine novel solutions or concepts.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Ask for ideas/brainstorming
      Agent->>Agent: Activate IdeationMode
      Agent->>Agent: Use [Think] Tool
      Agent->>Agent: Use [Brainstorm] Tool
      Agent->>Agent: Use [Critique] Tool
      Agent-->>User: Present generated & refined ideas
  ```

### 6. Debate Mode

- **Trigger:** Controversial topics, exploring multiple viewpoints, understanding different arguments.
- **Goal:** To present a balanced view of a contentious issue.
- **Sequence:**
  ```mermaid
  sequenceDiagram
      participant User
      participant Agent
      User->>Agent: Ask to debate/explore topic
      Agent->>Agent: Activate DebateMode
      Agent->>Agent: Use [Search] Tool (for facts)
      Agent->>Agent: Use [Debate] Tool
      Agent->>Agent: Use [Reflect] Tool
      Agent-->>User: Provide balanced perspectives
  ```

## Cognitive Tools Explained

The agent utilizes six specialized cognitive tools:

1.  **Think Tool:** Provides structured, step-by-step reasoning for complex problem decomposition and analysis.
2.  **Reflect Tool:** Enables meta-cognitive analysis, examining past information or experiences (within the conversation) to derive insights, lessons, or summaries.
3.  **Compare Tool:** Facilitates systematic comparison of multiple items against defined criteria, highlighting differences, similarities, pros, and cons.
4.  **Critique Tool:** Offers balanced critical evaluation, identifying strengths, weaknesses, and areas for improvement in arguments, proposals, or designs.
5.  **Brainstorm Tool:** Supports divergent thinking to generate a wide range of ideas or solutions across various categories.
6.  **Debate Tool:** Explores multiple perspectives on a topic, presenting different viewpoints fairly with supporting arguments.

## Example Use Cases & Prompts

Leverage the agent's modes with targeted prompts:

- **Research Mode:** "Explain the main factors contributing to climate change." / "Summarize the latest advancements in quantum computing."
- **Problem-Solving Mode:** "Outline a plan to improve employee retention in a tech startup." / "Calculate the estimated ROI for installing solar panels on a commercial building."
- **Evaluation Mode:** "Critique the effectiveness of universal basic income pilot programs." / "Analyze the ethical implications of gene editing."
- **Comparison Mode:** "Compare the advantages and disadvantages of Python vs. JavaScript for web development." / "Evaluate iOS vs. Android for a user focused on privacy."
- **Ideation Mode:** "Brainstorm novel applications for drone technology in agriculture." / "Generate ideas for reducing plastic waste in urban environments."
- **Debate Mode:** "Debate the pros and cons of nuclear energy." / "Explore the arguments for and against stricter regulations on social media platforms."

## Getting the Most Out of the Cognitive Reasoner

1.  **Be Clear About the Task:** Explicitly state if you want a comparison, critique, plan, etc., to help trigger the correct mode.
2.  **Trust the Process:** Allow the agent to follow its orchestrated sequence for best results.
3.  **Provide Sufficient Context:** Give the agent the necessary background information within your prompt.
4.  **Iterate if Needed:** Ask follow-up questions to refine the analysis or explore specific points further.

By combining specialized cognitive tools with intelligent orchestration, the Cognitive Reasoner provides a powerful and structured approach to tackling complex cognitive tasks.

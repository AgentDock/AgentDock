# Diagram Examples in the Open Source Client

This page demonstrates how to create and render various types of diagrams using Mermaid in the AgentDock Open Source Client. These diagram examples can be used for visualizing different aspects of your application architecture, workflows, and components when building with AgentDock.

## AgentDock Architecture Flow Chart

```mermaid
graph TD
    A[User Request] --> B{Is session active?}
    B -->|Yes| C[Create Agent Node]
    B -->|No| D[Initialize Session]
    D --> C
    C --> E[Process Request]
    E --> F{Success?}
    F -->|Yes| G[Return Result]
    F -->|No| H[Handle Error]
    H --> G
    G --> I[End]
```

## Request Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant App
    participant AgentDock
    participant LLM

    User->>App: Make request
    App->>AgentDock: Initialize session
    AgentDock->>LLM: Send prompt
    LLM-->>AgentDock: Return response
    AgentDock->>App: Process response
    App->>User: Display result
```

## AgentDock Core Class Diagram

```mermaid
classDiagram
    class BaseNode {
        +String id
        +String name
        +execute()
    }
    class AgentNode {
        +LLMContext context
        +processMessage()
    }
    class ToolNode {
        +Object parameters
        +executeWithContext()
    }
    BaseNode <|-- AgentNode
    BaseNode <|-- ToolNode
```

## AgentDock State Diagram

```mermaid
stateDiagram-v2
    [*] --> Idle
    Idle --> Processing: receive_request
    Processing --> Responding: generate_response
    Processing --> Error: throw_error
    Responding --> Idle: complete_response
    Error --> Idle: handle_error
    Idle --> [*]: shutdown
```

## AgentDock Data Model ER Diagram

```mermaid
erDiagram
    SESSION ||--o{ MESSAGE : contains
    SESSION {
        string id
        string userId
        timestamp created
    }
    MESSAGE {
        string id
        string content
        string role
        timestamp created
    }
    SESSION ||--|| USER : belongs_to
    USER {
        string id
        string name
        string email
    }
```

## AgentDock Development Roadmap

```mermaid
gantt
    title AgentDock Development Roadmap
    dateFormat  YYYY-MM-DD

    section Core Framework
    Provider-Agnostic API     :done,    des1, 2023-01-01, 2023-03-01
    Node System               :done,    des2, 2023-02-15, 2023-05-01
    Storage Abstraction       :active,  des3, 2023-04-01, 2023-08-01

    section Features
    Error Handling            :done,    des4, 2023-03-01, 2023-04-15
    BYOK Mode                 :active,  des5, 2023-05-01, 2023-07-01
    Advanced Memory           :         des6, 2023-06-01, 2023-09-01
    Vector Storage            :         des7, 2023-08-01, 2023-10-01
```

## Node Distribution Chart

```mermaid
pie title AgentDock Node Usage
    "Agent Nodes" : 42
    "Tool Nodes" : 28
    "Custom Nodes" : 30
```

## User Journey Diagram

```mermaid
journey
    title User Request Journey
    section Request Phase
      Receive Request: 5: User, App
      Parse Parameters: 3: App
      Initialize Session: 3: App, AgentDock
    section Processing Phase
      Agent Node Execution: 5: AgentDock
      Tool Node Execution: 4: AgentDock
      Error Handling: 2: AgentDock
    section Response Phase
      Format Response: 3: AgentDock
      Return Result: 5: App, User
```

## Adding Diagrams to Your Application

These diagrams demonstrate the visualization capabilities available in the AgentDock Open Source Client, helping to visualize concepts when building your own applications. To add a Mermaid diagram to any Markdown content in your application, use the following syntax:

````
```mermaid
graph TD
    A[Start] --> B[End]
````

For more information on Mermaid syntax, visit the [official Mermaid documentation](https://mermaid.js.org/syntax/flowchart.html).

## Open Source Client Rendering

The AgentDock Open Source Client includes built-in support for Mermaid diagrams, automatically rendering them in both light and dark modes. You can use these diagram examples as templates for creating your own visualizations of components and workflows in your AgentDock-based applications.

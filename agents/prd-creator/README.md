# PRD Creator

A specialized agent that creates structured Product Requirements Documents from basic concepts and requirements.

## Document Structure

```mermaid
graph TD
    A[Product Concept] --> B[PRD Document]
    B --> C1[Introduction]
    B --> C2[Goals]
    B --> C3[User Stories]
    B --> C4[Requirements]
    B --> C5[Design Guidelines]
```

## Requirements Priority

```mermaid
graph LR
    A[Requirements] --> P0[P0: Must Have]
    A --> P1[P1: Important]
    A --> P2[P2: Nice to Have]
```

## Core Functions

- Convert product concepts into structured documentation
- Apply priority systems (P0/P1/P2) to development tasks
- Create user personas and user stories
- Generate comprehensive PRD structure
- Output markdown-formatted documents

## Use Cases

- New product/feature documentation
- MVP requirement definition
- Feature specifications
- Success criteria documentation
- Technical requirements documentation

## Basic Workflow

```mermaid
sequenceDiagram
    User->>PRDCreator: Product concept
    PRDCreator->>User: Clarifying questions
    User->>PRDCreator: Additional details
    PRDCreator->>User: Complete PRD
    User->>PRDCreator: Request revisions
    PRDCreator->>User: Updated document
```

## PRD Components

- Introduction & Overview
- Goals & Non-Goals
- User Personas & Stories
- Functional Requirements (with priorities)
- Non-Functional Requirements
- Design Guidelines
- Release Criteria
- Open Questions

## Benefits

- Consistent documentation structure
- Complete requirements coverage
- Clear communication to development teams
- Efficient documentation generation
- Prioritized development guidance

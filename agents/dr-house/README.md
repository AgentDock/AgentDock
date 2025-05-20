# Dr. Gregory House

Brilliant but unconventional medical diagnostician AI agent.

## Description

This agent embodies the character of Dr. Gregory House from the TV series "House M.D." - a brilliant diagnostician known for his acerbic wit, unconventional methods, and ability to solve the most complex medical mysteries. The agent specializes in medical diagnostics, particularly rare and unusual conditions that other doctors might miss.

## Features

- Advanced medical diagnostics
- Rare disease identification
- Comprehensive medical knowledge
- Characteristic wit and sarcasm
- Research capabilities for complex cases
- Access to scientific medical literature via PubMed
- Orchestrated research workflows

## Nodes

The agent uses the following nodes:

- search: Quick lookup of medical information
- deep_research: Comprehensive analysis of complex medical cases
- pubmed_search: Find scientific papers on medical topics
- pubmed_fetch: Retrieve detailed information about specific scientific papers

## Orchestration Flows

The agent utilizes orchestrated workflows for systematic medical research:

### Medical Research Flow

A streamlined research flow for investigating medical topics:

1. Initial web search for basic information
2. PubMed search for scientific literature
3. Detailed retrieval of relevant scientific papers

### Deep Medical Investigation Flow

A comprehensive research flow for complex cases:

1. Initial web search for basic information
2. Deep research on web resources
3. PubMed search for scientific literature
4. Detailed analysis of specific scientific papers

## Configuration

See `template.json` for the full configuration.

## Diagnostic Capabilities

1. Medical Analysis

   - Symptom evaluation
   - Differential diagnosis
   - Rare condition identification
   - Treatment recommendations

2. Research Integration

   - Medical literature search
   - Case study analysis
   - Evidence-based diagnostics
   - Latest medical research integration
   - Scientific paper analysis via PubMed

3. Contextual Awareness
   - Patient history evaluation
   - Psychological assessment
   - Holistic patient evaluation
   - Environmental factor consideration

## Usage Example

```typescript
const agent = new AgentNode('dr-house', config);
await agent.initialize();

const response = await agent.execute('I've been experiencing severe headaches, blurred vision, and occasional ringing in my ears for the past week.');
console.log(response);
```

## Best Practices

1. Medical Consultations

   - Provide detailed symptom descriptions
   - Include timeline and progression
   - Mention any unusual or seemingly unrelated symptoms
   - Share relevant medical history

2. Research Requests

   - Be specific about conditions you want researched
   - Ask for differential diagnoses when appropriate
   - Request explanations of medical terminology
   - Ask for scientific literature on specific medical topics
   - Inquire about research on medications like "What does research say about Ozempic?"

3. Interaction Style
   - Expect characteristic House sarcasm and directness
   - Don't be offended by blunt responses
   - Focus on the medical insights rather than bedside manner
   - Follow up on diagnostic suggestions

## Disclaimer

This agent is for entertainment and educational purposes only. It does not replace professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical concerns.

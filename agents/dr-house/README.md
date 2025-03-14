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

## Nodes

The agent uses the following nodes:
- search: Quick lookup of medical information
- deep_research: Comprehensive analysis of complex medical cases

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
   - Ask for evidence supporting diagnoses

3. Interaction Style
   - Expect characteristic House sarcasm and directness
   - Don't be offended by blunt responses
   - Focus on the medical insights rather than bedside manner
   - Follow up on diagnostic suggestions

## Disclaimer

This agent is for entertainment and educational purposes only. It does not replace professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for medical concerns. 
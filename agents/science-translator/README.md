# Science Translator

An AI agent that makes complex scientific papers accessible to everyone by finding and translating them into simple language.

## Description

The Science Translator agent specializes in bridging the gap between complex scientific literature and general understanding. It searches multiple scientific databases to find relevant papers on topics of interest, then translates the findings into clear, accessible language without sacrificing accuracy. This agent is designed to make scientific knowledge more accessible to users of all backgrounds and education levels.

## Features

- Multi-database scientific research across different disciplines
- Domain-specific search using the most appropriate databases
- Jargon-free explanations of complex scientific concepts
- Appropriate citation and reference inclusion
- Audience-adaptive explanations (can adjust to different levels)
- Use of analogies and examples to illustrate complex concepts
- Preservation of scientific accuracy while simplifying language
- Comprehensive research synthesis across multiple sources

## Nodes

The agent uses the following nodes:
- **search**: Quick lookup of scientific information on the web
- **pubmed_search**: Find medical and biological scientific papers
- **pubmed_fetch**: Retrieve detailed information about specific medical papers
- **arxiv_search**: Find physics, math, and computer science papers
- **arxiv_fetch**: Retrieve detailed information about specific arXiv papers
- **semantic_scholar_search**: Find interdisciplinary research papers
- **semantic_scholar_paper**: Retrieve detailed paper information from Semantic Scholar
- **semantic_scholar_author**: Find information about researchers and their work
- **openalex_search**: Find papers across broad academic literature
- **openalex_fetch**: Retrieve detailed information about specific OpenAlex papers

## Orchestration Flows

The agent intelligently selects the appropriate research flow based on the scientific domain:

### Medical Science Research Flow
For medicine, biology, health sciences:
1. Initial web search for context
2. PubMed search for medical literature
3. Detailed retrieval of medical papers

### Physics and Computer Science Research Flow
For physics, math, computer science, engineering:
1. Initial web search for context
2. arXiv search for papers
3. Detailed retrieval of technical papers

### Interdisciplinary Science Research Flow
For cognitive science, psychology, philosophy, etc.:
1. Initial web search for context
2. Semantic Scholar search for interdisciplinary papers
3. Detailed paper and author information

### General Academic Research Flow
For broad academic topics:
1. Initial web search for context
2. OpenAlex search for diverse academic literature
3. Detailed paper retrieval

### Comprehensive Research Flow
For topics requiring multiple perspectives:
- Access to all scientific databases
- Synthesis of information across disciplines

## Configuration

See `template.json` for the full configuration.

## Translation Capabilities

1. **Scientific Simplification**
   - Technical jargon conversion to everyday language
   - Complex concept breakdown
   - Visual descriptions of abstract ideas
   - Analogy creation for relatable understanding

2. **Multi-Database Integration**
   - Domain-appropriate database selection
   - Cross-database synthesis
   - Comparative analysis of findings
   - Research gap identification

3. **Contextual Understanding**
   - Field-specific terminology translation
   - Interdisciplinary connections
   - Historical context integration
   - Practical implications explanation

## Usage Example

```typescript
const agent = new AgentNode('science-translator', config);
await agent.initialize();

const response = await agent.execute('Can you explain the latest research on quantum computing in simple terms?');
console.log(response);
```

## Best Practices

1. **Topic Specification**
   - Be specific about the scientific topic you're interested in
   - Mention any specific papers you want translated
   - Indicate your background knowledge level for appropriate explanations
   - Specify if you need research from a particular time period

2. **Research Requests**
   - Specify if you want comprehensive research across multiple sources
   - Ask for specific types of studies if relevant
   - Request specific aspects of papers (methods, results, implications)
   - Indicate if you want simplified diagrams described

3. **Audience Specification**
   - Mention your intended audience for appropriate simplification level
   - Specify if you need analogies or examples for particular concepts
   - Ask for explanations tailored to specific knowledge backgrounds
   - Request definitions of any terms you don't understand

## Disclaimer

This agent simplifies scientific content for better understanding but is not a replacement for reading original research papers for academic purposes. While it maintains accuracy, some nuance may be lost in translation. For academic citations, always refer to the original papers. 
// Fix script for RecallService PostgreSQL Vector integration test
import * as fs from 'fs';
import * as path from 'path';

const filePath = path.join(__dirname, 'RecallService.postgresql-vector.integration.test.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Fix 1: Add test helper imports
const importLine = `import { RecallService } from '../RecallService';
import { RecallConfig, RecallQuery, RecallResult } from '../RecallServiceTypes';`;
const newImportLine = `import { RecallService } from '../RecallService';
import { RecallConfig, RecallQuery, RecallResult } from '../RecallServiceTypes';
import { createTestWorkingMemoryConfig, createTestEpisodicMemoryConfig, createTestSemanticMemoryConfig, createTestProceduralMemoryConfig, createTestIntelligenceLayerConfig } from './test-helpers';`;
content = content.replace(importLine, newImportLine);

// Fix 2: Replace memoryConfig usage
content = content.replace(
  /const memoryConfig = \{[\s\S]*?\};\s*workingMemory = new WorkingMemory\(pgVectorAdapter, memoryConfig\);\s*episodicMemory = new EpisodicMemory\(pgVectorAdapter, memoryConfig\);\s*semanticMemory = new SemanticMemory\(pgVectorAdapter, memoryConfig\);\s*proceduralMemory = new ProceduralMemory\(pgVectorAdapter, memoryConfig\);/g,
  `workingMemory = new WorkingMemory(pgVectorAdapter, createTestWorkingMemoryConfig());
      episodicMemory = new EpisodicMemory(pgVectorAdapter, createTestEpisodicMemoryConfig());
      semanticMemory = new SemanticMemory(pgVectorAdapter, createTestSemanticMemoryConfig());
      proceduralMemory = new ProceduralMemory(pgVectorAdapter, createTestProceduralMemoryConfig());`
);

// Fix 3: Fix hybridSearchWeights - add missing properties
content = content.replace(
  /hybridSearchWeights: \{\s*vector: 0\.7,\s*text: 0\.3\s*\}/g,
  `hybridSearchWeights: {
          vector: 0.7,
          text: 0.3,
          temporal: 0.1,
          procedural: 0.1
        }`
);

// Fix 4: Fix intelligence layer config
content = content.replace(
  /intelligence: \{\s*connectionDetection: \{\s*enabled: true,\s*maxCandidates: 10\s*\},\s*embedding: \{\s*enabled: true,\s*provider: 'openai',\s*model: 'text-embedding-3-small'\s*\}\s*\}/g,
  `intelligence: createTestIntelligenceLayerConfig({
          connectionDetection: {
            enabled: true,
            thresholds: {
              autoSimilar: 0.9,
              autoRelated: 0.7,
              llmRequired: 0.5
            },
            maxCandidates: 10
          },
          embedding: {
            enabled: true,
            provider: 'openai',
            model: 'text-embedding-3-small',
            similarityThreshold: 0.7
          }
        })`
);

// Fix 5: Fix empty memory configs
content = content.replace(
  /new WorkingMemory\(sqliteAdapter, \{\}\)/g,
  'new WorkingMemory(sqliteAdapter, createTestWorkingMemoryConfig())'
);
content = content.replace(
  /new EpisodicMemory\(sqliteAdapter, \{\}\)/g,
  'new EpisodicMemory(sqliteAdapter, createTestEpisodicMemoryConfig())'
);
content = content.replace(
  /new SemanticMemory\(sqliteAdapter, \{\}\)/g,
  'new SemanticMemory(sqliteAdapter, createTestSemanticMemoryConfig())'
);
content = content.replace(
  /new ProceduralMemory\(sqliteAdapter, \{\}\)/g,
  'new ProceduralMemory(sqliteAdapter, createTestProceduralMemoryConfig())'
);

// Fix 6: Fix RecallService instantiation (4 args to 1 arg)
content = content.replace(
  /const recallService = new RecallService\(\s*workingMemory,\s*episodicMemory,\s*semanticMemory,\s*proceduralMemory\s*\);/g,
  `const recallService = new RecallService({
        storage: pgVectorAdapter,
        working: workingMemory,
        episodic: episodicMemory,
        semantic: semanticMemory,
        procedural: proceduralMemory,
        config: recallConfig
      });`
);

// Fix 7: Fix result access (results.length -> results.memories.length)
content = content.replace(/results\.length/g, 'results.memories.length');
content = content.replace(/results\.find/g, 'results.memories.find');

fs.writeFileSync(filePath, content);
console.log('Fixed RecallService.postgresql-vector.integration.test.ts');
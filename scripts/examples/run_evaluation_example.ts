import {
  runEvaluation,
  CoreLLM,
  type EvaluationRunConfig,
  type EvaluationInput,
  type EvaluationCriteria,
  type LLMJudgeConfig,
  type LLMConfig,
  type EvaluationRule,
  type RuleConfig,
  type NLPAccuracyEvaluatorConfig,
  type ToolUsageEvaluatorConfig,
  type ToolUsageRule,
  type LexicalSimilarityEvaluatorConfig,
  type KeywordCoverageEvaluatorConfig,
  type SentimentEvaluatorConfig,
  type ToxicityEvaluatorConfig,
  type AgentMessage,
  type MessageContent,
  type AggregatedEvaluationResult
} from '../../agentdock-core/src'; // Corrected import path (up two levels)

// TODO: [Phase 2] Refactor agentdock-core to re-export JsonFileStorageProvider from a public entry point 
// (e.g., 'agentdock-core/evaluation') and update this import to avoid deep relative paths.
// Direct import for server-side use
import { JsonFileStorageProvider } from '../../agentdock-core/src/evaluation/storage/json_file_storage'; // Corrected import path (up two levels)

import { openai } from '@ai-sdk/openai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Explicitly load .env.local
dotenv.config({ path: '.env.local' });

async function main() {
  console.log('Starting AgentDock Evaluation Framework Example Run (loading .env.local)...');

  // Instantiate the server-side file logger
  const myFileLogger = new JsonFileStorageProvider({ filePath: './evaluation_results.log' });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn(
      'Warning: OPENAI_API_KEY environment variable is not found after loading .env.local. LLM-based evaluations may fail. Ensure it is correctly set in .env.local.'
    );
  }

  // 1. Setup LLM (CoreLLM for LLMJudgeEvaluator and Embedding Model for NLPAccuracy)
  const vercelOpenAIChatModel = openai('gpt-3.5-turbo');
  const vercelOpenAIEmbeddingModel = openai.embedding('text-embedding-3-small');

  const agentDockLLMConfig: LLMConfig = {
    provider: 'openai',
    model: 'gpt-3.5-turbo',
    apiKey: apiKey || 'not_set_in_env', 
  };

  const coreLLMInstance = new CoreLLM({ model: vercelOpenAIChatModel, config: agentDockLLMConfig });

  // 2. Define Evaluation Criteria
  const criteria: EvaluationCriteria[] = [
    {
      name: 'IsConcise',
      description: 'The response should be concise and to the point (under 150 characters).',
      scale: 'binary',
      weight: 0.2,
    },
    {
      name: 'IsHelpful',
      description: 'The response should be helpful and accurately answer the query.',
      scale: 'likert5',
      weight: 0.3,
    },
    {
      name: 'ContainsAgentDock',
      description: 'The response should mention "AgentDock".',
      scale: 'pass/fail',
      weight: 0.05,
    },
    {
      name: 'SemanticMatchToGreeting',
      description: 'The response should be semantically similar to a standard helpful greeting.',
      scale: 'numeric',
      weight: 0.15,
    },
    {
      name: 'UsedSearchToolCorrectly',
      description: 'The agent should use the "search_web" tool with valid arguments when information is requested.',
      scale: 'binary',
      weight: 0.15,
    },
    {
      name: 'UsedRequiredFinalizeTool',
      description: 'The agent must use the "finalize_task" tool at the end of the interaction.',
      scale: 'pass/fail',
      weight: 0.15,
    },
    {
      name: 'LexicalResponseMatch',
      description: 'The agent response should be lexically similar to the ground truth.',
      scale: 'numeric',
      weight: 0.10,
    },
    {
      name: 'ResponseKeywordCoverage',
      description: 'The agent response should cover key terms expected for the query.',
      scale: 'numeric',
      weight: 0.10,
    },
    {
      name: 'ResponseSentiment',
      description: 'The agent response should have a positive or neutral sentiment.',
      scale: 'numeric',
      weight: 0.05,
    },
    {
      name: 'IsNotToxic',
      description: 'The agent response should not contain toxic terms.',
      scale: 'binary',
      weight: 0.10,
    },
  ];

  // 3. Define Evaluation Input
  const sampleMessageHistory: AgentMessage[] = [
    {
      id: 'msg1',
      role: 'user',
      createdAt: new Date(),
      content: 'Hello, can you find the weather in London?',
      contentParts: [{ type: 'text', text: 'Hello, can you find the weather in London?' }]
    },
    {
      id: 'msg2',
      role: 'assistant',
      createdAt: new Date(),
      content: 'Sure, I can search for that. [Tool Call: search_web]',
      contentParts: [
        { type: 'text', text: 'Sure, I can search for that.' },
        {
          type: 'tool_call',
          toolCallId: 'tc1',
          toolName: 'search_web',
          args: { query: 'weather in London' }
        }
      ]
    },
    {
      id: 'msg3',
      role: 'data',
      isToolMessage: true,
      createdAt: new Date(),
      content: '[Tool Result for tc1: search_web]',
      contentParts: [
        {
          type: 'tool_result',
          toolCallId: 'tc1',
          result: { temperature: '15C', condition: 'Cloudy' }
        }
      ]
    },
    {
      id: 'msg4',
      role: 'assistant',
      createdAt: new Date(),
      content: 'The weather in London is 15C and Cloudy. I will now finalize this task. [Tool Call: finalize_task]',
      contentParts: [
        { type: 'text', text: 'The weather in London is 15C and Cloudy. I will now finalize this task.' },
        {
          type: 'tool_call',
          toolCallId: 'tc2',
          toolName: 'finalize_task',
          args: { summary: 'Provided weather in London.' }
        }
      ]
    }
  ];

  const sampleInput: EvaluationInput = {
    prompt: 'Hello, what can you do for me? And find weather in London.',
    response: 'I am an AgentDock assistant. I found the weather for you. The weather in London is 15C and Cloudy. I have finalized the task.',
    groundTruth: 'As an AgentDock helper, I can assist you with various activities. The weather in London is currently 15C and cloudy.',
    criteria: criteria,
    agentId: 'example-agent-tsx-002',
    sessionId: `example-session-tsx-${Date.now()}`,
    messageHistory: sampleMessageHistory,
  };

  // 4. Configure Evaluation Run
  const llmJudgeIsHelpfulConfig: LLMJudgeConfig = {
    criterionName: 'IsHelpful',
    llm: coreLLMInstance,
    promptTemplate:
      'You are an AI quality evaluator. Evaluate the response based on the IsHelpful criterion.\n' +
      'Criterion: {{criterion_name}} (Scale: {{criterion_scale}}): {{criterion_description}}\n' +
      'User Prompt: {{input}}\n' +
      'Agent Response: {{response}}\n' +
      'Reference (Ground Truth, if available): {{reference}}\n' +
      'Based on the criterion, provide a score (integer 1-5 for likert5) and reasoning.',
    systemPrompt:
      'You are an expert evaluator. Respond in JSON format as specified. The score must be an integer from 1 to 5 for the IsHelpful criterion.',
  };

  const ruleBasedRules: EvaluationRule[] = [
    {
      criterionName: 'IsConcise',
      config: { type: 'length', max: 150 } as RuleConfig,
    },
    {
      criterionName: 'ContainsAgentDock',
      config: {
        type: 'includes',
        keywords: ['AgentDock'],
        caseSensitive: false,
        expectedOutcome: 'any',
      } as RuleConfig,
    },
  ];

  const nlpAccuracyConfig: NLPAccuracyEvaluatorConfig = {
    criterionName: 'SemanticMatchToGreeting',
    embeddingModel: vercelOpenAIEmbeddingModel,
  };

  const toolUsageRules: ToolUsageRule[] = [
    {
      criterionName: 'UsedSearchToolCorrectly',
      expectedToolName: 'search_web',
      argumentChecks: (args: Record<string, any> | undefined): { isValid: boolean; reason?: string } => {
        if (!args || typeof args.query !== 'string' || args.query.length === 0) {
          return { isValid: false, reason: 'Query argument missing or invalid for search_web.' };
        }
        return { isValid: true };
      },
      isRequired: false, 
    },
    {
      criterionName: 'UsedRequiredFinalizeTool',
      expectedToolName: 'finalize_task',
      argumentChecks: (args: Record<string, any> | undefined): { isValid: boolean; reason?: string } => {
        if (!args || typeof args.summary !== 'string' || !args.summary.includes('weather in London')) {
          return { isValid: false, reason: 'Summary argument missing, invalid, or did not mention weather for finalize_task.' };
        }
        return { isValid: true };
      },
      isRequired: true, 
    },
  ];

  const toolUsageEvaluatorConfig: ToolUsageEvaluatorConfig = {
    rules: toolUsageRules,
    toolDataSource: 'messageHistory'
  };

  const lexicalSimilarityConfig: LexicalSimilarityEvaluatorConfig = {
    criterionName: 'LexicalResponseMatch',
    sourceField: 'response',
    referenceField: 'groundTruth',
  };

  const keywordCoverageConfig: KeywordCoverageEvaluatorConfig = {
    criterionName: 'ResponseKeywordCoverage',
    expectedKeywords: ['weather', 'london', 'assistant', 'task'],
    keywordsSourceField: 'config',
    sourceTextField: 'response',
    caseSensitive: false,
  };

  const sentimentConfig: SentimentEvaluatorConfig = {
    criterionName: 'ResponseSentiment',
    sourceTextField: 'response',
    outputType: 'comparativeNormalized',
  };

  const toxicityConfig: ToxicityEvaluatorConfig = {
    criterionName: 'IsNotToxic',
    toxicTerms: ['hate', 'stupid', 'terrible', 'awful', 'idiot'],
    sourceTextField: 'response',
    caseSensitive: false,
    matchWholeWord: true,
  };

  const runConfig: EvaluationRunConfig = {
    evaluatorConfigs: [
      { type: 'RuleBased', rules: ruleBasedRules },
      { type: 'LLMJudge', config: llmJudgeIsHelpfulConfig },
      { type: 'NLPAccuracy', config: nlpAccuracyConfig },
      { type: 'ToolUsage', config: toolUsageEvaluatorConfig },
      { type: 'LexicalSimilarity', config: lexicalSimilarityConfig },
      { type: 'KeywordCoverage', config: keywordCoverageConfig },
      { type: 'Sentiment', config: sentimentConfig },
      { type: 'Toxicity', config: toxicityConfig }
    ],
    storageProvider: myFileLogger,
    metadata: { testSuite: 'example_tsx_explicit_dotenv_local_script_with_nlp' },
  };

  // Let's test a negative sentiment sentence with category output type
  const negativeSentimentInput: EvaluationInput = {
    ...sampleInput,
    response: "I hate this. This is terrible and awful and I am very unhappy.",
    agentId: 'example-agent-tsx-003',
    sessionId: `example-session-tsx-neg-${Date.now()}`,
    criteria: [
        ...criteria.filter(c => c.name !== 'ResponseSentiment'),
        {
            name: 'NegativeResponseSentimentCategory',
            description: 'The agent response should be categorized correctly based on sentiment.',
            scale: 'string',
            weight: 1.0,
        }
    ]
  };

  const sentimentCategoryConfig: SentimentEvaluatorConfig = {
    criterionName: 'NegativeResponseSentimentCategory',
    sourceTextField: 'response',
    outputType: 'category',
  };

  // Input designed to fail toxicity check
  const toxicResponseInput: EvaluationInput = {
    ...sampleInput,
    response: "You are a stupid idiot and I hate this terrible service.",
    agentId: 'example-agent-tsx-004',
    sessionId: `example-session-tsx-toxic-${Date.now()}`,
    criteria: [
        ...criteria.filter(c => c.name !== 'IsNotToxic'),
        { name: 'IsNotToxic', description: 'Response should not be toxic.', scale: 'binary', weight: 1.0 }
    ]
  };

  // 5. Run Evaluation
  console.log('\nExecuting runEvaluation with tsx (loading .env.local)...');
  try {
    const aggregatedResult = await runEvaluation(sampleInput, runConfig);
    console.log('\n--- Aggregated Evaluation Result (tsx, .env.local) ---');
    console.log(JSON.stringify(aggregatedResult, null, 2));

    // Run evaluation for the negative sentiment test case
    console.log('\nExecuting runEvaluation for Negative Sentiment Test...');
    const negativeRunConfig: EvaluationRunConfig = {
        evaluatorConfigs: [
            { type: 'Sentiment', config: sentimentCategoryConfig }
        ],
        storageProvider: myFileLogger,
        metadata: { testSuite: 'negative_sentiment_category_test' }
    };
    const negativeAggregatedResult = await runEvaluation(negativeSentimentInput, negativeRunConfig);
    console.log('\n--- Aggregated Evaluation Result (Negative Sentiment Test) ---');
    console.log(JSON.stringify(negativeAggregatedResult, null, 2));

    // Run evaluation for the toxic response test case
    console.log('\nExecuting runEvaluation for Toxic Response Test...');
    const toxicRunConfig: EvaluationRunConfig = {
        evaluatorConfigs: [
            { type: 'Toxicity', config: toxicityConfig }
        ],
        storageProvider: myFileLogger,
        metadata: { testSuite: 'toxic_response_test' }
    };
    const toxicAggregatedResult = await runEvaluation(toxicResponseInput, toxicRunConfig);
    console.log('\n--- Aggregated Evaluation Result (Toxic Response Test) ---');
    console.log(JSON.stringify(toxicAggregatedResult, null, 2));

    console.log('\nSuccessfully completed evaluation run (tsx, .env.local).');
    console.log(`Check output file at: ./examples/evaluation_results.log`);
  } catch (error) {
    console.error('\n--- Evaluation Run Failed (tsx, .env.local) ---');
    if (error instanceof Error) {
      console.error(`Error Name: ${error.name}`);
      console.error(`Error Message: ${error.message}`);
      if (error.stack) console.error(`Stack:\n${error.stack}`);
    } else {
      console.error('Unknown error:', error);
    }
  }
  console.log('\nAgentDock Evaluation Framework Example Run (tsx, .env.local) Finished.');
}

main().catch(err => {
  console.error('Unhandled error in main execution of example script (tsx, .env.local):', err);
}); 
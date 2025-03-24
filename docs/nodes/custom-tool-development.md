# Custom Tool Development

This guide provides a comprehensive overview of creating custom tools for AgentDock, with complete examples and best practices.

## Introduction

Custom tools extend the capabilities of AI agents in AgentDock, allowing them to perform specialized tasks such as searching the web, analyzing data, or integrating with external APIs. Tools are essentially specialized nodes that follow a consistent pattern, making them easy to create and maintain.

## Tool Structure in the Reference Implementation

In the AgentDock reference implementation, tools are organized as follows:

```
src/nodes/[tool-name]/
├── index.ts        # Main tool implementation
├── components.tsx  # React components for output
└── utils.ts        # Helper functions (optional)
```

## Complete Custom Tool Example: Weather Tool

Let's walk through creating a complete weather forecasting tool.

### Step 1: Create Directory Structure

```
src/nodes/weather/
├── index.ts        # Main implementation
├── components.tsx  # Output formatting
└── utils.ts        # API utilities
```

### Step 2: Implement the Tool

```typescript
// index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { logger, LogCategory } from '@/lib/logger';
import { createToolResult, formatErrorMessage } from '@/lib/utils/markdown-utils';
import { WeatherForecast } from './components';
import { fetchWeatherData } from './utils';

// Parameter schema for the weather tool
const weatherSchema = z.object({
  location: z.string().describe('City name or location to get weather for'),
  days: z.number().optional().default(3).describe('Number of days to forecast (1-7)')
});

// Weather tool implementation
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Get weather forecast for any location',
  parameters: weatherSchema,
  async execute({ location, days = 3 }, options) {
    try {
      // Validate input
      if (!location) {
        return createToolResult(
          'weather_error',
          formatErrorMessage('Error', 'Location is required')
        );
      }

      // Limit days to a reasonable range
      const forecastDays = Math.min(Math.max(days, 1), 7);
      
      // Fetch weather data
      const weatherData = await fetchWeatherData(location, forecastDays);
      
      // Return formatted results
      return WeatherForecast({
        location: weatherData.location.name,
        days: weatherData.forecast.forecastday
      });
    } catch (error) {
      // Log and handle errors
      logger.error(LogCategory.NODE, '[Weather]', 'Weather tool error:', { error, location });
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return createToolResult(
        'weather_error',
        formatErrorMessage('Error', `Unable to get weather for "${location}": ${errorMessage}`)
      );
    }
  }
};

// Export for auto-registration
export const tools = {
  weather: weatherTool
};
```

### Step 3: Create Output Components

```typescript
// components.tsx
import { formatBold, formatHeader, formatItalic, joinSections, createToolResult } from '@/lib/utils/markdown-utils';

// Types for weather data
export interface WeatherDay {
  date: string;
  day: {
    maxtemp_c: number;
    mintemp_c: number;
    condition: {
      text: string;
      icon: string;
    };
    daily_chance_of_rain: number;
  };
}

export interface WeatherForecastProps {
  location: string;
  days: WeatherDay[];
}

// Component to format weather forecast output
export function WeatherForecast(props: WeatherForecastProps) {
  const { location, days } = props;
  
  // Format each day's forecast
  const forecastDays = days.map(day => {
    const date = new Date(day.date).toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric'
    });
    
    return `${formatBold(date)}
Temperature: ${day.day.mintemp_c}°C to ${day.day.maxtemp_c}°C
Condition: ${day.day.condition.text}
Chance of rain: ${day.day.daily_chance_of_rain}%`;
  });
  
  // Combine into a single result
  return createToolResult(
    'weather_forecast',
    joinSections(
      formatHeader(`Weather forecast for ${location}`),
      forecastDays.join('\n\n')
    )
  );
}
```

### Step 4: Implement API Utilities

```typescript
// utils.ts
import { z } from 'zod';

// Type validation for API response
const weatherResponseSchema = z.object({
  location: z.object({
    name: z.string(),
    region: z.string(),
    country: z.string(),
  }),
  forecast: z.object({
    forecastday: z.array(z.object({
      date: z.string(),
      day: z.object({
        maxtemp_c: z.number(),
        mintemp_c: z.number(),
        condition: z.object({
          text: z.string(),
          icon: z.string(),
        }),
        daily_chance_of_rain: z.number(),
      })
    }))
  })
});

// Function to fetch weather data from API
export async function fetchWeatherData(location: string, days: number) {
  // Get API key from environment variable
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    throw new Error('Weather API key not configured');
  }
  
  // Make API request
  const response = await fetch(
    `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=${days}&aqi=no&alerts=no`
  );
  
  // Handle API errors
  if (!response.ok) {
    let errorText = `API error: ${response.status}`;
    try {
      const errorData = await response.json();
      if (errorData.error && errorData.error.message) {
        errorText = errorData.error.message;
      }
    } catch (e) {
      // Ignore JSON parsing errors
    }
    throw new Error(errorText);
  }
  
  // Parse and validate response
  const data = await response.json();
  return weatherResponseSchema.parse(data);
}
```

## Using the LLM in Custom Tools

Custom tools can access the agent's LLM instance for generating content or analyzing data:

```typescript
// Example: Using LLM in a news summarization tool
async execute({ query }, options) {
  try {
    // Fetch news articles
    const articles = await fetchNewsArticles(query);
    
    // Use LLM to generate a summary if available
    if (options.llmContext?.llm) {
      // Format articles for the LLM
      const articlesText = articles.map(a => 
        `TITLE: ${a.title}\nSUMMARY: ${a.description}`
      ).join('\n\n');
      
      // Create prompt for the LLM
      const messages = [
        {
          role: 'system',
          content: 'You are a news summarization assistant. Create a concise summary of these news articles about the given topic. Focus on the most important information and common themes.'
        },
        {
          role: 'user',
          content: `Topic: ${query}\n\nArticles:\n${articlesText}\n\nPlease create a concise summary of these news articles.`
        }
      ];
      
      // Generate summary with the LLM
      const result = await options.llmContext.llm.generateText({ 
        messages,
        temperature: 0.3,
        maxTokens: 500
      });
      
      // Return formatted result
      return NewsSummary({ 
        query, 
        articles,
        summary: result.text
      });
    }
    
    // Fallback if LLM is not available
    return NewsSummary({ 
      query, 
      articles,
      summary: "AI-generated summary not available. Please review the article excerpts below."
    });
  } catch (error) {
    // Error handling
    return createToolResult(
      'news_error',
      formatErrorMessage('Error', `Failed to fetch news: ${error.message}`)
    );
  }
}
```

## Tool Registration Process

Tools are automatically registered when imported by the `src/nodes/init.ts` file:

```typescript
// src/nodes/init.ts example
import { tools as searchTools } from './search';
import { tools as weatherTools } from './weather';
import { tools as stockPriceTools } from './stock-price';
// ... other tool imports

// Combine all tools into a single object
export const allTools = {
  ...searchTools,
  ...weatherTools,
  ...stockPriceTools,
  // ... other tools
};

// Register tools with the registry
export function registerTools() {
  const registry = getToolRegistry();
  Object.entries(allTools).forEach(([name, tool]) => {
    registry.registerTool(name, tool);
  });
}
```

## Advanced Tool Features

### 1. Tool Chaining

Tools can use the results of previous tools:

```typescript
// Research tool using search results
export const researchTool: Tool = {
  name: 'research',
  description: 'Research a topic in depth',
  parameters: researchSchema,
  async execute({ query, depth = 2 }, options) {
    // First, search for information
    const searchResults = await searchWeb(query);
    
    // Then, analyze the results with the LLM
    if (options.llmContext?.llm) {
      const analysis = await options.llmContext.llm.generateText({
        messages: [
          {
            role: 'system',
            content: 'Analyze these search results and identify key insights.'
          },
          {
            role: 'user',
            content: `Analyze these search results about "${query}": ${JSON.stringify(searchResults)}`
          }
        ]
      });
      
      return ResearchResults({ query, results: searchResults, analysis: analysis.text });
    }
    
    return ResearchResults({ query, results: searchResults });
  }
};
```

### 2. Multi-Step Tools

Tools can implement multi-step processes:

```typescript
// Multi-step data analysis tool
export const dataAnalysisTool: Tool = {
  name: 'analyze_data',
  description: 'Analyze data in multiple steps',
  parameters: dataAnalysisSchema,
  async execute({ dataset, analysis_type }, options) {
    try {
      // Step 1: Load and validate data
      const data = await loadDataset(dataset);
      
      // Step 2: Perform statistical analysis
      const stats = performStatisticalAnalysis(data, analysis_type);
      
      // Step 3: Generate insights with LLM
      let insights = "Statistical analysis complete";
      if (options.llmContext?.llm) {
        const result = await options.llmContext.llm.generateText({
          messages: [
            {
              role: 'system',
              content: `You are a data analysis expert. Generate insights based on the statistical analysis of a dataset.`
            },
            {
              role: 'user',
              content: `Dataset: ${dataset}\nAnalysis Type: ${analysis_type}\nStatistics: ${JSON.stringify(stats)}\n\nWhat insights can we draw from this analysis?`
            }
          ]
        });
        insights = result.text;
      }
      
      // Return formatted results
      return DataAnalysisResults({
        dataset,
        analysis_type,
        statistics: stats,
        insights
      });
    } catch (error) {
      return createToolResult(
        'analysis_error',
        formatErrorMessage('Error', `Analysis failed: ${error.message}`)
      );
    }
  }
};
```

## Best Practices

### 1. Input Validation

Always validate inputs with Zod schemas:

```typescript
const stockPriceSchema = z.object({
  symbol: z.string().describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
  period: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', '5y'])
    .default('1m')
    .describe('Time period for historical data')
});
```

### 2. Error Handling

Implement comprehensive error handling:

```typescript
try {
  // Tool logic
} catch (error) {
  logger.error(LogCategory.NODE, '[MyTool]', 'Execution error:', { error });
  
  // Provide user-friendly error messages
  let errorMessage = 'An unexpected error occurred';
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  }
  
  return createToolResult(
    'error',
    formatErrorMessage('Error', errorMessage)
  );
}
```

### 3. Output Formatting

Format outputs consistently:

```typescript
return createToolResult(
  'my_tool_result',
  joinSections(
    formatHeader(`Results for ${query}`),
    formatBold('Key Findings:'),
    results.join('\n\n')
  )
);
```

### 4. API Security

Secure API access:

```typescript
// Never include API keys in the code
const apiKey = process.env.MY_API_KEY;
if (!apiKey) {
  throw new Error('API key not configured');
}

// Use HTTPS for all external requests
const response = await fetch(`https://api.example.com/data?key=${apiKey}&q=${encodeURIComponent(query)}`);

// Validate API responses
if (!response.ok) {
  throw new Error(`API error: ${response.status}`);
}
```

### 5. Performance

Optimize performance:

```typescript
// Cache expensive operations
const cachedResults = await redis.get(`cache:${cacheKey}`);
if (cachedResults) {
  return JSON.parse(cachedResults);
}

// Set reasonable timeouts
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 5000);
try {
  const response = await fetch(url, { signal: controller.signal });
  // Process response
} finally {
  clearTimeout(timeoutId);
}
```

## Troubleshooting

Common issues and solutions:

### 1. Tool Not Registered

If your tool isn't appearing in the agent:

```typescript
// Make sure you're exporting the tools object
export const tools = {
  my_tool: myTool
};

// Check that your tool is imported in src/nodes/init.ts
```

### 2. Parameter Errors

If parameters aren't working correctly:

```typescript
// Use descriptive parameter names
const searchSchema = z.object({
  query: z.string().describe('Search query to look up'),
  // NOT: q: z.string().describe('Search query')
});

// Set reasonable defaults for optional parameters
const limit = z.number().optional().default(10).describe('Maximum results');
```

### 3. Output Not Displaying

If tool output isn't displaying correctly:

```typescript
// Make sure you're using createToolResult
return createToolResult('my_tool_result', formattedOutput);

// NOT: return formattedOutput;
```

## More Examples

### Stock Price Tool

```typescript
// stock-price/index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { StockPriceResults } from './components';
import { fetchStockData } from './utils';

const stockPriceSchema = z.object({
  symbol: z.string().describe('Stock ticker symbol (e.g., AAPL, MSFT)'),
  period: z.enum(['1d', '1w', '1m', '3m', '6m', '1y', '5y'])
    .default('1m')
    .describe('Time period for historical data')
});

export const stockPriceTool: Tool = {
  name: 'stock_price',
  description: 'Get stock price information and historical data',
  parameters: stockPriceSchema,
  async execute({ symbol, period = '1m' }) {
    try {
      const stockData = await fetchStockData(symbol, period);
      return StockPriceResults({ symbol, period, data: stockData });
    } catch (error) {
      return createToolResult(
        'stock_price_error',
        formatErrorMessage('Error', `Unable to get stock data for ${symbol}: ${error.message}`)
      );
    }
  }
};

export const tools = {
  stock_price: stockPriceTool
};
```

### Image Analysis Tool

```typescript
// image-analysis/index.ts
import { z } from 'zod';
import { Tool } from '../types';
import { analyzeImage } from './utils';
import { ImageAnalysisResults } from './components';

const imageAnalysisSchema = z.object({
  url: z.string().url().describe('URL of the image to analyze'),
  analysis_type: z.enum(['objects', 'faces', 'text', 'colors'])
    .default('objects')
    .describe('Type of analysis to perform on the image')
});

export const imageAnalysisTool: Tool = {
  name: 'analyze_image',
  description: 'Analyze an image to detect objects, faces, text, or colors',
  parameters: imageAnalysisSchema,
  async execute({ url, analysis_type = 'objects' }) {
    try {
      const results = await analyzeImage(url, analysis_type);
      return ImageAnalysisResults({ url, analysis_type, results });
    } catch (error) {
      return createToolResult(
        'image_analysis_error',
        formatErrorMessage('Error', `Image analysis failed: ${error.message}`)
      );
    }
  }
};

export const tools = {
  analyze_image: imageAnalysisTool
};
```

## Conclusion

Custom tools are a powerful way to extend AgentDock's capabilities. By following the patterns and practices outlined in this guide, you can create sophisticated tools that enhance your AI agents with specialized functionality.

For more information, refer to the Node System documentation and the AgentDock Core API reference. 
/**
 * @fileoverview Weather tool implementation using Open-Meteo APIs.
 * Provides weather forecast functionality for any location worldwide.
 */

import { z } from 'zod';
import { Tool } from '../types';
import { 
  weatherCardSchema, 
  weatherForecastSchema, 
  WeatherCard, 
  createWeatherCard,
  createWeatherForecast
} from './components';
import type { WeatherForecast } from './types';

/**
 * Schema for weather tool parameters
 */
const weatherSchema = z.object({
  location: z.string().describe('City name or coordinates (e.g. "New York" or "40.7128,-74.0060")')
});

/**
 * Type inference from schema
 */
type WeatherParams = z.infer<typeof weatherSchema>;

/**
 * Weather tool implementation
 */
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Get weather forecast for any location worldwide. You can provide either a city name (e.g. "New York") or coordinates (e.g. "40.7128,-74.0060")',
  parameters: weatherSchema,
  async execute({ location }) {
    try {
      // Get the absolute URL for the API endpoint
      const url = new URL('/api/tools/weather', process.env.NODE_ENV === 'development'
        ? 'http://localhost:3000'
        : 'https://agent-dock.vercel.app');

      // Add the location parameter
      url.searchParams.set('location', location);
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch weather data');
      }

      const weatherInfo = await response.json() as WeatherForecast;

      // Create markdown content
      const currentWeather = createWeatherCard({
        location: {
          name: weatherInfo.location.name || 'Unknown Location',
          country: weatherInfo.location.country || 'Unknown Country',
          region: weatherInfo.location.region
        },
        current: weatherInfo.current
      });

      const forecast = createWeatherForecast({
        daily: weatherInfo.daily
      });

      // Return formatted response matching ToolResult type
      return {
        type: 'tool_result',
        content: `${currentWeather}\n\n${forecast}`,
        metadata: {
          data: weatherInfo,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error('Weather tool error:', {
        location,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Weather tool error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  weather: weatherTool
}; 
/**
 * @fileoverview Weather tool implementation using Open-Meteo APIs.
 * Follows Vercel AI SDK patterns for generative UI.
 */

import { z } from 'zod';
import { Tool } from '../types';
import type { WeatherForecast } from './types';
import { Weather } from './components';
import { getCoordinates, parseCoordinates, getWeatherForecast } from './utils';
import { logger, LogCategory } from 'agentdock-core';

/**
 * Schema for weather tool parameters
 */
const weatherSchema = z.object({
  location: z.string().describe('City name or coordinates (e.g. "New York" or "40.7128,-74.0060")')
});

type WeatherParams = z.infer<typeof weatherSchema>;

/**
 * Weather tool implementation
 */
export const weatherTool: Tool = {
  name: 'weather',
  description: 'Get weather forecast for any location worldwide. You can provide either a city name (e.g. "New York") or coordinates (e.g. "40.7128,-74.0060")',
  parameters: weatherSchema,
  async execute({ location }) {
    logger.info(LogCategory.NODE, 'WeatherTool', `Executing weather tool with location: ${location}`);
    try {
      // Parse coordinates or geocode the location
      const coords = parseCoordinates(location);
      let latitude: number, longitude: number, name: string, country: string, region: string;

      if (coords) {
        [latitude, longitude] = coords;
        name = `${latitude},${longitude}`;
        country = 'Coordinates';
        region = '';
        logger.info(LogCategory.NODE, 'WeatherTool', `Using provided coordinates: ${latitude},${longitude}`);
      } else {
        logger.info(LogCategory.NODE, 'WeatherTool', `Geocoding location: ${location}`);
        [latitude, longitude, name, country, region] = await getCoordinates(location);
        logger.info(LogCategory.NODE, 'WeatherTool', `Geocoded to: ${name}, ${country} (${latitude},${longitude})`);
      }

      // Get weather forecast from Open-Meteo
      const apiResponse = await getWeatherForecast(latitude, longitude);

      // Format the response into our WeatherForecast structure
      const weatherInfo: WeatherForecast = {
        location: {
          name,
          country,
          region,
          lat: latitude,
          lon: longitude
        },
        current: {
          temperature: apiResponse.current.temperature_2m,
          windSpeed: apiResponse.current.wind_speed_10m,
          windDirection: apiResponse.current.wind_direction_10m,
          weatherCode: apiResponse.current.weather_code,
          isDay: apiResponse.current.is_day
        },
        daily: apiResponse.daily.time.map((date: string, i: number) => ({
          date,
          temperatureMin: apiResponse.daily.temperature_2m_min[i],
          temperatureMax: apiResponse.daily.temperature_2m_max[i],
          weatherCode: apiResponse.daily.weather_code[i],
          windSpeed: apiResponse.daily.wind_speed_10m_max[i],
          windDirection: apiResponse.daily.wind_direction_10m_dominant[i],
          precipitationProbability: apiResponse.daily.precipitation_probability_max[i]
        }))
      };

      // Format data for our Weather component
      const weatherData = {
        current: {
          location: {
            name: weatherInfo.location.name,
            country: weatherInfo.location.country,
            region: weatherInfo.location.region || '',
            coordinates: {
              lat: weatherInfo.location.lat,
              lon: weatherInfo.location.lon
            }
          },
          conditions: {
            temperature: weatherInfo.current.temperature,
            windSpeed: weatherInfo.current.windSpeed,
            windDirection: weatherInfo.current.windDirection,
            weatherCode: weatherInfo.current.weatherCode,
            isDay: weatherInfo.current.isDay === 1
          }
        },
        forecast: weatherInfo.daily.map((day, _index) => ({
          date: day.date,
          temperature: {
            min: day.temperatureMin,
            max: day.temperatureMax
          },
          conditions: {
            weatherCode: day.weatherCode,
            windSpeed: day.windSpeed,
            windDirection: day.windDirection,
            precipitationProbability: day.precipitationProbability
          }
        })),
        timestamp: new Date().toISOString()
      };

      // Use our Weather component to format the output
      return Weather(weatherData);
    } catch (error) {
      logger.error(LogCategory.NODE, 'WeatherTool', 'Weather tool error', {
        location,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }
};

/**
 * Export tools for registry
 */
export const tools = {
  weather: weatherTool
}; 
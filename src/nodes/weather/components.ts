/**
 * @fileoverview Weather UI components for rendering weather data.
 * These components are used by the weather tool to display weather information.
 */

import { z } from 'zod';

/**
 * Weather icon mapping
 */
export const weatherIcons: Record<number, string> = {
  0: '☀️',  // Clear sky
  1: '🌤️',  // Partly cloudy
  2: '☁️',  // Cloudy
  3: '☁️',  // Overcast
  45: '🌫️', // Foggy
  48: '🌫️', // Depositing rime fog
  51: '🌧️', // Light drizzle
  53: '🌧️', // Moderate drizzle
  55: '🌧️', // Dense drizzle
  61: '🌧️', // Slight rain
  63: '🌧️', // Moderate rain
  65: '🌧️', // Heavy rain
  71: '🌨️', // Slight snow
  73: '🌨️', // Moderate snow
  75: '🌨️', // Heavy snow
  77: '🌨️', // Snow grains
  80: '🌧️', // Slight rain showers
  81: '🌧️', // Moderate rain showers
  82: '🌧️', // Violent rain showers
  85: '🌨️', // Slight snow showers
  86: '🌨️', // Heavy snow showers
  95: '⛈️', // Thunderstorm
  96: '⛈️', // Thunderstorm with slight hail
  99: '⛈️'  // Thunderstorm with heavy hail
};

/**
 * Wind direction to arrow mapping
 */
export function getWindArrow(degrees: number): string {
  const arrows = ['↑', '↗️', '→', '↘️', '↓', '↙️', '←', '↖️'];
  const index = Math.round(degrees / 45) % 8;
  return arrows[index];
}

/**
 * Base component interface
 */
interface BaseComponent {
  type: string;
  id: string;
  className?: string;
  style?: Record<string, string>;
}

/**
 * Weather card component schema
 */
export const weatherCardSchema = z.object({
  type: z.literal('weather_card'),
  id: z.string(),
  className: z.string().optional(),
  style: z.record(z.string()).optional(),
  data: z.object({
    location: z.object({
      name: z.string(),
      country: z.string(),
      region: z.string().optional()
    }),
    current: z.object({
      temperature: z.number(),
      windSpeed: z.number(),
      windDirection: z.number(),
      weatherCode: z.number(),
      isDay: z.number()
    })
  })
});

/**
 * Weather forecast component schema
 */
export const weatherForecastSchema = z.object({
  type: z.literal('weather_forecast'),
  id: z.string(),
  className: z.string().optional(),
  style: z.record(z.string()).optional(),
  data: z.object({
    daily: z.array(z.object({
      date: z.string(),
      temperatureMin: z.number(),
      temperatureMax: z.number(),
      weatherCode: z.number(),
      windSpeed: z.number(),
      windDirection: z.number(),
      precipitationProbability: z.number()
    }))
  })
});

/**
 * Type inference from schemas
 */
export type WeatherCard = z.infer<typeof weatherCardSchema>;
export type WeatherForecast = z.infer<typeof weatherForecastSchema>;

/**
 * Helper function to format temperature
 */
export function formatTemperature(temp: number): string {
  return `${Math.round(temp)}°C`;
}

/**
 * Helper function to format wind
 */
export function formatWind(speed: number, direction: number): string {
  return `${getWindArrow(direction)} ${Math.round(speed)} km/h`;
}

/**
 * Helper function to format date
 */
export function formatDate(dateStr: string): string {
  // Create date in local timezone
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });
}

/**
 * Helper function to get weather description
 */
export function getWeatherDescription(code: number): string {
  const descriptions: Record<number, string> = {
    0: 'Clear sky',
    1: 'Partly cloudy',
    2: 'Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime fog',
    51: 'Light drizzle',
    53: 'Moderate drizzle',
    55: 'Dense drizzle',
    61: 'Light rain',
    63: 'Moderate rain',
    65: 'Heavy rain',
    71: 'Light snow',
    73: 'Moderate snow',
    75: 'Heavy snow',
    77: 'Snow grains',
    80: 'Light rain showers',
    81: 'Moderate rain showers',
    82: 'Violent rain showers',
    85: 'Light snow showers',
    86: 'Heavy snow showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with hail',
    99: 'Thunderstorm with heavy hail'
  };
  return descriptions[code] || 'Unknown';
}

/**
 * Helper function to create a weather card component
 */
export function createWeatherCard(data: WeatherCard['data']): string {
  const { location, current } = data;
  const icon = weatherIcons[current.weatherCode] || '❓';
  const description = getWeatherDescription(current.weatherCode);
  const wind = formatWind(current.windSpeed, current.windDirection);
  const temp = formatTemperature(current.temperature);
  
  return `## Current Weather in ${location.name}, ${location.country}${location.region ? `, ${location.region}` : ''}

${icon} **${description}**
- Temperature: ${temp}
- Wind: ${wind}
- Time: ${current.isDay ? 'Day' : 'Night'}`;
}

/**
 * Helper function to create a weather forecast component
 */
export function createWeatherForecast(data: WeatherForecast['data']): string {
  const forecastHeader = `## 7-Day Forecast\n`;
  
  const forecastDays = data.daily.map(day => {
    const icon = weatherIcons[day.weatherCode] || '❓';
    const date = formatDate(day.date);
    const tempMin = formatTemperature(day.temperatureMin);
    const tempMax = formatTemperature(day.temperatureMax);
    const wind = formatWind(day.windSpeed, day.windDirection);
    const precip = Math.round(day.precipitationProbability);
    
    return `### ${date}
${icon} **${getWeatherDescription(day.weatherCode)}**
- Temperature Range: ${tempMin} to ${tempMax}
- Wind: ${wind}
- Precipitation: ${precip}%`;
  }).join('\n\n');

  return forecastHeader + '\n' + forecastDays;
} 
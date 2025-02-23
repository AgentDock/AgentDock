import { NextResponse } from 'next/server';
import { fetchWithCors, getCoordinates, parseCoordinates } from '../../../../nodes/weather/utils';
import type { WeatherApiResponse } from '../../../../nodes/weather/types';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');

    if (!location) {
      return NextResponse.json(
        { error: 'Location parameter is required' },
        { status: 400 }
      );
    }

    // Parse coordinates or geocode the location
    const coords = parseCoordinates(location);
    let latitude: number, longitude: number, name: string, country: string, region: string;

    if (coords) {
      [latitude, longitude] = coords;
      name = `${latitude},${longitude}`;
      country = 'Coordinates';
      region = '';
    } else {
      [latitude, longitude, name, country, region] = await getCoordinates(location);
    }

    // Get weather forecast from Open-Meteo
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endDate = new Date(today);
    endDate.setUTCDate(today.getUTCDate() + 6);
    const startDateStr = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    const weatherData = await fetchWithCors<WeatherApiResponse>(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,is_day&daily=weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,precipitation_probability_max&timezone=UTC&start_date=${startDateStr}&end_date=${endDateStr}`
    );

    const weatherInfo = {
      location: {
        name,
        country,
        region,
        lat: latitude,
        lon: longitude
      },
      current: {
        temperature: weatherData.current.temperature_2m,
        windSpeed: weatherData.current.wind_speed_10m,
        windDirection: weatherData.current.wind_direction_10m,
        weatherCode: weatherData.current.weather_code,
        isDay: weatherData.current.is_day
      },
      daily: weatherData.daily.time.map((date: string, i: number) => ({
        date,
        temperatureMin: weatherData.daily.temperature_2m_min[i],
        temperatureMax: weatherData.daily.temperature_2m_max[i],
        weatherCode: weatherData.daily.weather_code[i],
        windSpeed: weatherData.daily.wind_speed_10m_max[i],
        windDirection: weatherData.daily.wind_direction_10m_dominant[i],
        precipitationProbability: weatherData.daily.precipitation_probability_max[i]
      }))
    };

    return NextResponse.json(weatherInfo);
  } catch (error) {
    console.error('Weather API error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 
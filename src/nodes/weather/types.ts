/**
 * Geocoding result interface
 */
export interface GeocodingResult {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country: string;
    admin1?: string; // State/Province
  }>;
}

/**
 * Weather API response interface
 */
export interface WeatherApiResponse {
  current: {
    temperature_2m: number;
    wind_speed_10m: number;
    wind_direction_10m: number;
    weather_code: number;
    is_day: number;
  };
  daily: {
    time: string[];
    temperature_2m_min: number[];
    temperature_2m_max: number[];
    weather_code: number[];
    wind_speed_10m_max: number[];
    wind_direction_10m_dominant: number[];
    precipitation_probability_max: number[];
  };
}

/**
 * Weather forecast interface
 */
export interface WeatherForecast {
  location: {
    name: string;
    country: string;
    region?: string;
    lat: number;
    lon: number;
  };
  current: {
    temperature: number;
    windSpeed: number;
    windDirection: number;
    weatherCode: number;
    isDay: number;
  };
  daily: Array<{
    date: string;
    temperatureMin: number;
    temperatureMax: number;
    weatherCode: number;
    windSpeed: number;
    windDirection: number;
    precipitationProbability: number;
  }>;
}

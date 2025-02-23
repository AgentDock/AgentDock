import type { GeocodingResult } from './types';

/**
 * Parse coordinates from string
 * @returns [latitude, longitude] or null if invalid
 */
export function parseCoordinates(location: string): [number, number] | null {
  const parts = location.split(',').map(part => parseFloat(part.trim()));
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
  const [lat, lon] = parts;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return [lat, lon];
}

/**
 * Wrapper for fetch with Edge-compatible error handling
 */
export async function fetchWithCors<T>(url: string): Promise<T> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const response = await fetch(url, {
      headers: { 
        'Accept': 'application/json'
      },
      signal: controller.signal,
      cache: 'no-store', // Ensure fresh data in Edge environment
      next: { revalidate: 0 } // Disable caching in Edge runtime
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      const errorDetails = {
        url,
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        runtime: typeof window === 'undefined' ? 'edge/server' : 'client'
      };
      console.error('API Error:', errorDetails);
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data as T;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout: ${url}`);
      }
      if (error.name === 'TypeError') {
        // Network errors or other fetch-related issues
        console.error('Network Error:', {
          url,
          error: error.message,
          runtime: typeof window === 'undefined' ? 'edge/server' : 'client',
          stack: error.stack
        });
        throw new Error(`Network error: ${error.message}`);
      }
      console.error('Fetch error:', {
        url,
        error: error.message,
        runtime: typeof window === 'undefined' ? 'edge/server' : 'client',
        stack: error.stack
      });
      throw new Error(`Failed to fetch weather data: ${error.message}`);
    }
    throw new Error('An unexpected error occurred');
  }
}

/**
 * Get coordinates for a location using Open-Meteo geocoding API
 */
export async function getCoordinates(location: string): Promise<[number, number, string, string, string]> {
  try {
    const data = await fetchWithCors<GeocodingResult>(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`
    );

    if (!data.results?.length) {
      throw new Error(`Location "${location}" not found`);
    }

    const { latitude, longitude, name, country, admin1 } = data.results[0];
    return [latitude, longitude, name, country, admin1 || ''];
  } catch (error) {
    throw new Error(`Failed to get location coordinates: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
} 
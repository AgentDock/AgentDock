/**
 * Masks sensitive data like API keys for logging
 * @param key The sensitive string to mask
 * @param visibleChars Number of characters to show at the start (default: 5)
 * @returns Masked string with only the first few characters visible
 */
export function maskSensitiveData(key: string, visibleChars: number = 5): string {
  if (!key) return '';
  return `${key.substring(0, visibleChars)}...`;
}

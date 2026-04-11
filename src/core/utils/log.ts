import { Sanitizer } from './sanitizer.js';

/**
 * Enhanced logging utility that automatically sanitizes all payloads.
 */
export function logError(error: Error | string | any): void {
  const message = typeof error === 'string' ? error : error.stack || error.message;
  const sanitized = Sanitizer.sanitizeSecrets(message);
  console.error(`[demandAI Error] ${new Date().toISOString()}:`, sanitized);
}

export function logInfo(message: string): void {
  const sanitized = Sanitizer.sanitizeSecrets(message);
  console.log(`[demandAI Info] ${new Date().toISOString()}: ${sanitized}`);
}

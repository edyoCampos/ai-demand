import { Sanitizer } from './sanitizer.js';
/**
 * Enhanced logging utility that automatically sanitizes all payloads.
 */
export function logError(error) {
    const message = typeof error === 'string' ? error : error.stack || error.message;
    const sanitized = Sanitizer.sanitizeString(message);
    console.error(`[demandAI Error] ${new Date().toISOString()}:`, sanitized);
}
export function logInfo(message) {
    const sanitized = Sanitizer.sanitizeString(message);
    console.log(`[demandAI Info] ${new Date().toISOString()}: ${sanitized}`);
}
//# sourceMappingURL=log.js.map
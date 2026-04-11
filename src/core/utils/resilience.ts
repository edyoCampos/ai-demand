export interface RetryOptions {  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  signal?: AbortSignal;
}

export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 5,
  baseDelay: 1000,
  maxDelay: 32000,
};

/**
 * Executes an operation with exponential backoff and jitter.
 * Inspired by DemandAI's resilient patterns.
 */
export async function withRetry<T>(
  operation: (attempt: number) => Promise<T>,
  options: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    if (options.signal?.aborted) {
      throw new Error('AbortError: Operation cancelled by user or timeout.');
    }
    
    try {
      return await operation(attempt);
    } catch (error: any) {
      lastError = error;
      
      // Don't retry on certain errors (400, 401, 403, 404)
      const status = error.status || error.response?.status;
      if (status && [400, 401, 403, 404].includes(status)) {
        throw error;
      }

      if (attempt === options.maxRetries) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        options.maxDelay,
        options.baseDelay * Math.pow(2, attempt - 1)
      );
      const jitter = Math.random() * 0.25 * delay;
      const finalDelay = delay + jitter;

      if (process.env.DEBUG) {
        console.log(`[Resilience] Attempt ${attempt} failed. Retrying in ${Math.round(finalDelay)}ms...`);
      }
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, finalDelay);
        if (options.signal) {
          options.signal.addEventListener('abort', () => {
             clearTimeout(timeout);
             reject(new Error('AbortError: Operation cancelled during backoff.'));
          }, { once: true });
        }
      });
    }
  }

  throw lastError;
}

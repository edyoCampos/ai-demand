export interface RetryOptions {
    maxRetries: number;
    baseDelay: number;
    maxDelay: number;
    signal?: AbortSignal;
}
export declare const DEFAULT_RETRY_OPTIONS: RetryOptions;
/**
 * Executes an operation with exponential backoff and jitter.
 * Inspired by openclaude's withRetry logic.
 */
export declare function withRetry<T>(operation: (attempt: number) => Promise<T>, options?: RetryOptions): Promise<T>;
//# sourceMappingURL=resilience.d.ts.map
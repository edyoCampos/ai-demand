/**
 * Sanitizes strings and objects to remove sensitive information.
 * Dynamically loads secrets from process.env to ensure custom API keys are redacted.
 */
export declare class Sanitizer {
    private static CUSTOM_SECRETS;
    private static SENSITIVE_PATTERNS;
    static sanitizeString(input: string): string;
    static sanitizeObject(obj: any): any;
}
//# sourceMappingURL=sanitizer.d.ts.map
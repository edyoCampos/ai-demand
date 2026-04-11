/**
 * Sanitizes strings and objects to remove sensitive information.
 * Dynamically loads secrets from process.env to ensure custom API keys are redacted.
 */
export class Sanitizer {
    static CUSTOM_SECRETS = [];
    static {
        // Collect potential secrets from environment variables at startup
        // Only collect strings that look like keys (length > 10)
        for (const key in process.env) {
            const val = process.env[key];
            if (val && val.length > 12 && (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN'))) {
                this.CUSTOM_SECRETS.push(val);
            }
        }
    }
    static SENSITIVE_PATTERNS = [
        /sk-[a-zA-Z0-9]{32,}/g,
        /gsk_[a-zA-Z0-9]{32,}/g,
        /x-api-key:[a-zA-Z0-9]{32,}/g,
        /bearer [a-zA-Z0-9\._-]{32,}/gi
    ];
    static sanitizeString(input) {
        if (!input)
            return input;
        let output = input;
        // Check static patterns
        for (const pattern of this.SENSITIVE_PATTERNS) {
            output = output.replace(pattern, '[REDACTED_SECRET]');
        }
        // Check dynamic secrets from env
        for (const secret of this.CUSTOM_SECRETS) {
            if (output.includes(secret)) {
                output = output.split(secret).join('[REDACTED_ENV_SECRET]');
            }
        }
        return output;
    }
    static sanitizeObject(obj) {
        if (typeof obj !== 'object' || obj === null) {
            if (typeof obj === 'string')
                return this.sanitizeString(obj);
            return obj;
        }
        if (Array.isArray(obj)) {
            return obj.map(item => this.sanitizeObject(item));
        }
        const cleaned = {};
        for (const key in obj) {
            if (['apiKey', 'secret', 'password', 'token', 'key'].some(k => key.toLowerCase().includes(k))) {
                cleaned[key] = '[REDACTED_PROPERTY]';
            }
            else {
                cleaned[key] = this.sanitizeObject(obj[key]);
            }
        }
        return cleaned;
    }
}
//# sourceMappingURL=sanitizer.js.map
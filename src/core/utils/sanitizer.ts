/**
 * Sanitizer - Security layer for inputs, outputs and filenames.
 */
export class Sanitizer {
  private static CUSTOM_SECRETS: string[] = [];
  private static SENSITIVE_PATTERNS = [
    /sk-[a-zA-Z0-9]{32,}/g, 
    /gsk_[a-zA-Z0-9]{32,}/g, 
    /x-api-key:[a-zA-Z0-9]{32,}/g,
    /bearer [a-zA-Z0-9\._-]{32,}/gi
  ];

  static {
    // Collect potential secrets from environment variables at startup
    // Only collect strings that look like keys (length > 12)
    for (const key in process.env) {
      const val = process.env[key];
      if (val && val.length > 12 && (key.includes('KEY') || key.includes('SECRET') || key.includes('TOKEN'))) {
        this.CUSTOM_SECRETS.push(val);
      }
    }
  }

  /**
   * Redacts sensitive information from strings.
   */
  static sanitizeSecrets(input: string): string {
    if (!input) return input;
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

  /**
   * Sanitizes a string to be used as a safe filename, preventing path traversal.
   */
  static sanitizeFilename(name: string): string {
    if (!name) return 'unnamed_entry';
    // Remove directory traversal sequences and invalid characters
    return name
      .replace(/\.\./g, '') // No path traversal
      .replace(/[\\/]/g, '') // No slashes
      .replace(/[<>:"|?*]/g, '') // No Windows-invalid chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .toLowerCase()
      .slice(0, 100); // Limit length
  }

  /**
   * Basic detection for common prompt injection patterns.
   */
  static hasPromptInjection(input: string): boolean {
    const suspiciousPatterns = [
      /ignore previous instructions/i,
      /you are now/i,
      /forget everything/i,
      /stop being/i,
      /system override/i,
      /new instruction/i
    ];
    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Recursively sanitizes objects, redacting sensitive property names and values.
   */
  static sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      if (typeof obj === 'string') return this.sanitizeSecrets(obj);
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const cleaned: any = {};
    for (const key in obj) {
      const lowerKey = key.toLowerCase();
      if (['apikey', 'secret', 'password', 'token', 'key'].some(k => lowerKey.includes(k))) {
        cleaned[key] = '[REDACTED_PROPERTY]';
      } else {
        cleaned[key] = this.sanitizeObject(obj[key]);
      }
    }
    return cleaned;
  }
}

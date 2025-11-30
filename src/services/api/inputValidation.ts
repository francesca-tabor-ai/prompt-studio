export interface ValidationRule {
  field: string;
  type: 'string' | 'number' | 'email' | 'url' | 'uuid' | 'array' | 'object';
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
  custom?: (value: any) => boolean;
  sanitize?: boolean;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  sanitizedData?: any;
}

class InputValidationService {
  private static instance: InputValidationService;

  private emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  private uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  private urlPattern = /^https?:\/\/.+/;

  private dangerousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /<iframe[^>]*>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /(\bUNION\b.*\bSELECT\b)/i,
    /('; DROP TABLE)/i,
  ];

  private constructor() {}

  static getInstance(): InputValidationService {
    if (!InputValidationService.instance) {
      InputValidationService.instance = new InputValidationService();
    }
    return InputValidationService.instance;
  }

  validate(data: any, rules: ValidationRule[]): ValidationResult {
    const errors: string[] = [];
    const sanitizedData: any = { ...data };

    for (const rule of rules) {
      const value = data[rule.field];

      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push(`${rule.field} is required`);
        continue;
      }

      if (value === undefined || value === null) {
        continue;
      }

      if (!this.validateType(value, rule.type)) {
        errors.push(`${rule.field} must be of type ${rule.type}`);
        continue;
      }

      if (rule.type === 'string') {
        if (rule.minLength && value.length < rule.minLength) {
          errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
        }

        if (rule.maxLength && value.length > rule.maxLength) {
          errors.push(`${rule.field} must be at most ${rule.maxLength} characters`);
        }

        if (rule.pattern && !rule.pattern.test(value)) {
          errors.push(`${rule.field} format is invalid`);
        }

        if (rule.sanitize) {
          sanitizedData[rule.field] = this.sanitizeString(value);
        }
      }

      if (rule.type === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push(`${rule.field} must be at least ${rule.min}`);
        }

        if (rule.max !== undefined && value > rule.max) {
          errors.push(`${rule.field} must be at most ${rule.max}`);
        }
      }

      if (rule.type === 'email' && !this.emailPattern.test(value)) {
        errors.push(`${rule.field} must be a valid email address`);
      }

      if (rule.type === 'url' && !this.urlPattern.test(value)) {
        errors.push(`${rule.field} must be a valid URL`);
      }

      if (rule.type === 'uuid' && !this.uuidPattern.test(value)) {
        errors.push(`${rule.field} must be a valid UUID`);
      }

      if (rule.custom && !rule.custom(value)) {
        errors.push(`${rule.field} failed custom validation`);
      }

      if (this.containsDangerousContent(value)) {
        errors.push(`${rule.field} contains potentially dangerous content`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      sanitizedData: errors.length === 0 ? sanitizedData : undefined,
    };
  }

  private validateType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'email':
        return typeof value === 'string' && this.emailPattern.test(value);
      case 'url':
        return typeof value === 'string' && this.urlPattern.test(value);
      case 'uuid':
        return typeof value === 'string' && this.uuidPattern.test(value);
      case 'array':
        return Array.isArray(value);
      case 'object':
        return typeof value === 'object' && !Array.isArray(value) && value !== null;
      default:
        return false;
    }
  }

  sanitizeString(input: string): string {
    return input
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }

  sanitizeObject<T extends Record<string, any>>(obj: T): T {
    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = this.sanitizeString(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item) =>
          typeof item === 'string' ? this.sanitizeString(item) : item
        );
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = this.sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  private containsDangerousContent(value: any): boolean {
    if (typeof value !== 'string') {
      if (typeof value === 'object') {
        return this.containsDangerousContent(JSON.stringify(value));
      }
      return false;
    }

    return this.dangerousPatterns.some((pattern) => pattern.test(value));
  }

  validateEmail(email: string): boolean {
    return this.emailPattern.test(email);
  }

  validateURL(url: string): boolean {
    return this.urlPattern.test(url);
  }

  validateUUID(uuid: string): boolean {
    return this.uuidPattern.test(uuid);
  }

  preventSQLInjection(input: string): string {
    return input
      .replace(/'/g, "''")
      .replace(/;/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '');
  }

  preventXSS(input: string): string {
    return this.sanitizeString(input);
  }

  preventPathTraversal(path: string): string {
    return path.replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  }

  validatePassword(password: string): ValidationResult {
    const errors: string[] = [];

    if (password.length < 12) {
      errors.push('Password must be at least 12 characters long');
    }

    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (!/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateAPIKey(apiKey: string): boolean {
    return /^[A-Za-z0-9_-]{32,}$/.test(apiKey);
  }

  whitelistString(input: string, allowedChars: RegExp): string {
    return input.split('').filter((char) => allowedChars.test(char)).join('');
  }

  truncateString(input: string, maxLength: number): string {
    return input.length > maxLength ? input.substring(0, maxLength) : input;
  }
}

export const inputValidationService = InputValidationService.getInstance();

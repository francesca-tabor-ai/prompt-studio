export type MaskingStrategy = 'full' | 'partial' | 'hash' | 'redact' | 'tokenize';

export interface MaskingRule {
  field: string;
  strategy: MaskingStrategy;
  preserveLength?: boolean;
  visibleChars?: number;
}

class DataMaskingService {
  private static instance: DataMaskingService;

  private sensitivePatterns = {
    email: /([a-zA-Z0-9._-]+)@([a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi,
    phone: /(\+?1[-.\s]?)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/g,
    ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
    creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    apiKey: /\b[A-Za-z0-9]{32,}\b/g,
    jwt: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
    ipv4: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  };

  private constructor() {}

  static getInstance(): DataMaskingService {
    if (!DataMaskingService.instance) {
      DataMaskingService.instance = new DataMaskingService();
    }
    return DataMaskingService.instance;
  }

  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return '***@***.***';

    const maskedLocal =
      local.length <= 2
        ? '***'
        : local[0] + '*'.repeat(Math.min(local.length - 2, 5)) + local[local.length - 1];

    const [domainName, tld] = domain.split('.');
    const maskedDomain = domainName[0] + '*'.repeat(Math.min(domainName.length - 1, 3));

    return `${maskedLocal}@${maskedDomain}.${tld}`;
  }

  maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(***) ***-${cleaned.slice(-4)}`;
    } else if (cleaned.length === 11) {
      return `+* (***) ***-${cleaned.slice(-4)}`;
    }
    return '***-***-****';
  }

  maskCreditCard(cardNumber: string): string {
    const cleaned = cardNumber.replace(/\D/g, '');
    if (cleaned.length >= 12) {
      return `****-****-****-${cleaned.slice(-4)}`;
    }
    return '****-****-****-****';
  }

  maskSSN(ssn: string): string {
    const cleaned = ssn.replace(/\D/g, '');
    if (cleaned.length === 9) {
      return `***-**-${cleaned.slice(-4)}`;
    }
    return '***-**-****';
  }

  maskIPAddress(ip: string): string {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.***.***.`;
    }
    return '***.***.***.***';
  }

  maskAPIKey(apiKey: string): string {
    if (apiKey.length <= 8) {
      return '*'.repeat(apiKey.length);
    }
    return `${apiKey.slice(0, 4)}${'*'.repeat(apiKey.length - 8)}${apiKey.slice(-4)}`;
  }

  maskString(
    value: string,
    strategy: MaskingStrategy = 'partial',
    visibleChars: number = 4
  ): string {
    if (!value) return '';

    switch (strategy) {
      case 'full':
        return '*'.repeat(value.length);

      case 'partial':
        if (value.length <= visibleChars * 2) {
          return '*'.repeat(value.length);
        }
        const start = value.slice(0, visibleChars);
        const end = value.slice(-visibleChars);
        const middle = '*'.repeat(Math.min(value.length - visibleChars * 2, 10));
        return `${start}${middle}${end}`;

      case 'hash':
        return this.hashValue(value);

      case 'redact':
        return '[REDACTED]';

      case 'tokenize':
        return this.tokenize(value);

      default:
        return value;
    }
  }

  private hashValue(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  private tokenize(value: string): string {
    return `token_${Math.random().toString(36).substr(2, 16)}`;
  }

  maskObject<T extends Record<string, any>>(obj: T, rules: MaskingRule[]): T {
    const masked = { ...obj };

    for (const rule of rules) {
      if (masked[rule.field] !== undefined && masked[rule.field] !== null) {
        masked[rule.field] = this.maskString(
          String(masked[rule.field]),
          rule.strategy,
          rule.visibleChars
        );
      }
    }

    return masked;
  }

  maskSensitiveData(data: any): any {
    if (typeof data === 'string') {
      return this.maskStringData(data);
    }

    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    if (typeof data === 'object' && data !== null) {
      const masked: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          masked[key] = this.maskByFieldName(key, value);
        } else {
          masked[key] = this.maskSensitiveData(value);
        }
      }
      return masked;
    }

    return data;
  }

  private isSensitiveField(fieldName: string): boolean {
    const sensitiveKeywords = [
      'password',
      'secret',
      'token',
      'key',
      'apikey',
      'api_key',
      'ssn',
      'credit_card',
      'creditcard',
      'cvv',
      'pin',
    ];

    const lowerField = fieldName.toLowerCase();
    return sensitiveKeywords.some((keyword) => lowerField.includes(keyword));
  }

  private maskByFieldName(fieldName: string, value: any): string {
    if (typeof value !== 'string') {
      return '[REDACTED]';
    }

    const lowerField = fieldName.toLowerCase();

    if (lowerField.includes('email')) {
      return this.maskEmail(value);
    }

    if (lowerField.includes('phone')) {
      return this.maskPhone(value);
    }

    if (lowerField.includes('ssn')) {
      return this.maskSSN(value);
    }

    if (lowerField.includes('credit') || lowerField.includes('card')) {
      return this.maskCreditCard(value);
    }

    if (lowerField.includes('password') || lowerField.includes('secret')) {
      return '[REDACTED]';
    }

    return this.maskString(value, 'partial', 4);
  }

  private maskStringData(text: string): string {
    let masked = text;

    masked = masked.replace(this.sensitivePatterns.email, (match) =>
      this.maskEmail(match)
    );

    masked = masked.replace(this.sensitivePatterns.phone, (match) =>
      this.maskPhone(match)
    );

    masked = masked.replace(this.sensitivePatterns.ssn, (match) => this.maskSSN(match));

    masked = masked.replace(this.sensitivePatterns.creditCard, (match) =>
      this.maskCreditCard(match)
    );

    masked = masked.replace(this.sensitivePatterns.apiKey, (match) =>
      this.maskAPIKey(match)
    );

    masked = masked.replace(this.sensitivePatterns.jwt, () => '[JWT_TOKEN]');

    masked = masked.replace(this.sensitivePatterns.ipv4, (match) =>
      this.maskIPAddress(match)
    );

    return masked;
  }

  maskErrorMessage(error: Error): Error {
    const maskedError = new Error(this.maskStringData(error.message));
    maskedError.name = error.name;
    maskedError.stack = error.stack
      ? this.maskStringData(error.stack)
      : undefined;
    return maskedError;
  }

  maskLogData(logData: any): any {
    return this.maskSensitiveData(logData);
  }

  createMaskingProxy<T extends object>(target: T): T {
    return new Proxy(target, {
      get: (obj, prop) => {
        const value = obj[prop as keyof T];

        if (typeof prop === 'string' && this.isSensitiveField(prop)) {
          return this.maskByFieldName(prop, value);
        }

        return value;
      },
    });
  }

  generateSafeCopy<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: string[]
  ): T {
    const safe = { ...obj };

    for (const field of sensitiveFields) {
      if (safe[field] !== undefined) {
        safe[field] = '[REDACTED]';
      }
    }

    return safe;
  }

  isDataMasked(value: string): boolean {
    return (
      value.includes('***') ||
      value.includes('[REDACTED]') ||
      value.startsWith('hash_') ||
      value.startsWith('token_')
    );
  }
}

export const dataMaskingService = DataMaskingService.getInstance();

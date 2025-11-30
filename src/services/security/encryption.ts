import CryptoJS from 'crypto-js';

export interface EncryptionResult {
  ciphertext: string;
  iv: string;
  salt: string;
  keyVersion: number;
}

export interface DecryptionParams {
  ciphertext: string;
  iv: string;
  salt: string;
  keyVersion?: number;
}

class EncryptionService {
  private static instance: EncryptionService;
  private currentKeyVersion: number = 1;
  private encryptionKeys: Map<number, string> = new Map();

  private constructor() {
    this.initializeKeys();
  }

  static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  private initializeKeys(): void {
    const masterKey = import.meta.env.VITE_ENCRYPTION_MASTER_KEY || this.generateKey();
    this.encryptionKeys.set(1, masterKey);

    const rotatedKey = import.meta.env.VITE_ENCRYPTION_KEY_V2;
    if (rotatedKey) {
      this.encryptionKeys.set(2, rotatedKey);
      this.currentKeyVersion = 2;
    }
  }

  private generateKey(): string {
    return CryptoJS.lib.WordArray.random(256 / 8).toString();
  }

  private getCurrentKey(): string {
    const key = this.encryptionKeys.get(this.currentKeyVersion);
    if (!key) {
      throw new Error('Encryption key not found');
    }
    return key;
  }

  private getKey(version: number): string {
    const key = this.encryptionKeys.get(version);
    if (!key) {
      throw new Error(`Encryption key version ${version} not found`);
    }
    return key;
  }

  encryptAES256(plaintext: string): EncryptionResult {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    const key = CryptoJS.PBKDF2(this.getCurrentKey(), salt, {
      keySize: 256 / 32,
      iterations: 10000,
    });

    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return {
      ciphertext: encrypted.toString(),
      iv: iv.toString(),
      salt: salt.toString(),
      keyVersion: this.currentKeyVersion,
    };
  }

  decryptAES256(params: DecryptionParams): string {
    const keyVersion = params.keyVersion || 1;
    const key = CryptoJS.PBKDF2(
      this.getKey(keyVersion),
      CryptoJS.enc.Hex.parse(params.salt),
      {
        keySize: 256 / 32,
        iterations: 10000,
      }
    );

    const decrypted = CryptoJS.AES.decrypt(params.ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(params.iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return decrypted.toString(CryptoJS.enc.Utf8);
  }

  encryptField(value: string, fieldName?: string): string {
    const result = this.encryptAES256(value);
    return JSON.stringify(result);
  }

  decryptField(encryptedValue: string): string {
    try {
      const params = JSON.parse(encryptedValue) as DecryptionParams;
      return this.decryptAES256(params);
    } catch (error) {
      console.error('Field decryption failed:', error);
      return '';
    }
  }

  hashPassword(password: string): string {
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const hash = CryptoJS.PBKDF2(password, salt, {
      keySize: 512 / 32,
      iterations: 100000,
    });

    return `pbkdf2$100000$${salt.toString()}$${hash.toString()}`;
  }

  verifyPassword(password: string, hashedPassword: string): boolean {
    try {
      const parts = hashedPassword.split('$');
      if (parts.length !== 4) return false;

      const iterations = parseInt(parts[1]);
      const salt = CryptoJS.enc.Hex.parse(parts[2]);
      const storedHash = parts[3];

      const hash = CryptoJS.PBKDF2(password, salt, {
        keySize: 512 / 32,
        iterations: iterations,
      });

      return hash.toString() === storedHash;
    } catch (error) {
      return false;
    }
  }

  rotateKey(newKey: string): void {
    const newVersion = this.currentKeyVersion + 1;
    this.encryptionKeys.set(newVersion, newKey);
    this.currentKeyVersion = newVersion;

    console.log(`Encryption key rotated to version ${newVersion}`);
  }

  async reEncryptData(oldData: DecryptionParams): Promise<EncryptionResult> {
    const plaintext = this.decryptAES256(oldData);
    return this.encryptAES256(plaintext);
  }

  encryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: string[]
  ): T {
    const result = { ...obj };

    for (const field of sensitiveFields) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = this.encryptField(String(result[field]), field);
      }
    }

    return result;
  }

  decryptObject<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: string[]
  ): T {
    const result = { ...obj };

    for (const field of sensitiveFields) {
      if (result[field]) {
        try {
          result[field] = this.decryptField(result[field]);
        } catch (error) {
          console.error(`Failed to decrypt field ${field}:`, error);
        }
      }
    }

    return result;
  }

  generateSecureToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  hashData(data: string, algorithm: 'SHA256' | 'SHA512' = 'SHA256'): string {
    return algorithm === 'SHA256'
      ? CryptoJS.SHA256(data).toString()
      : CryptoJS.SHA512(data).toString();
  }

  generateHMAC(data: string, secret?: string): string {
    const key = secret || this.getCurrentKey();
    return CryptoJS.HmacSHA256(data, key).toString();
  }

  verifyHMAC(data: string, hmac: string, secret?: string): boolean {
    const computed = this.generateHMAC(data, secret);
    return computed === hmac;
  }
}

export const encryptionService = EncryptionService.getInstance();

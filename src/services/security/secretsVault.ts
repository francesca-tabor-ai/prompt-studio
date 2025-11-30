import { supabase } from '../../lib/supabase';
import { encryptionService } from './encryption';

export type SecretType =
  | 'password'
  | 'api_key'
  | 'certificate'
  | 'encryption_key'
  | 'database_password'
  | 'oauth_token'
  | 'ssh_key'
  | 'generic';

export interface SecretConfig {
  name: string;
  type: SecretType;
  value: string;
  rotationEnabled?: boolean;
  rotationIntervalDays?: number;
  expiresInDays?: number;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface Secret {
  id: string;
  name: string;
  secretType: SecretType;
  currentVersion: number;
  status: string;
  rotationEnabled: boolean;
  lastRotatedAt: Date;
  nextRotationAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

class SecretsVault {
  private static instance: SecretsVault;
  private cache: Map<string, { value: string; expiresAt: number }> = new Map();

  private constructor() {
    this.startRotationMonitoring();
    this.startCacheCleanup();
  }

  static getInstance(): SecretsVault {
    if (!SecretsVault.instance) {
      SecretsVault.instance = new SecretsVault();
    }
    return SecretsVault.instance;
  }

  async createSecret(
    config: SecretConfig,
    userId?: string
  ): Promise<string> {
    const encryptedValue = encryptionService.encryptField(config.value);

    const rotationInterval = config.rotationIntervalDays
      ? `${config.rotationIntervalDays} days`
      : '90 days';

    const expiresAt = config.expiresInDays
      ? new Date(Date.now() + config.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const { data, error } = await supabase
      .from('secrets')
      .insert({
        name: config.name,
        secret_type: config.type,
        encrypted_value: encryptedValue,
        rotation_enabled: config.rotationEnabled ?? false,
        rotation_interval: rotationInterval,
        expires_at: expiresAt?.toISOString(),
        metadata: config.metadata || {},
        tags: config.tags || [],
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create secret: ${error.message}`);
    }

    await supabase.from('secret_versions').insert({
      secret_id: data.id,
      version_number: 1,
      encrypted_value: encryptedValue,
      is_current: true,
      created_by: userId,
    });

    await supabase.from('secret_metadata').insert({
      secret_id: data.id,
      owner_id: userId,
      risk_level: this.assessRiskLevel(config.type),
    });

    if (config.rotationEnabled) {
      await this.scheduleRotation(data.id);
    }

    await this.logAccess(data.id, userId, 'create', true);

    return data.id;
  }

  async getSecret(
    name: string,
    userId?: string,
    version?: number
  ): Promise<string> {
    const cacheKey = `${name}:${version || 'current'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return cached.value;
    }

    const { data: secret, error } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', name)
      .single();

    if (error || !secret) {
      await this.logAccess(null, userId, 'read', false);
      throw new Error('Secret not found');
    }

    const hasAccess = await this.checkAccess(name, userId, 'read');
    if (!hasAccess) {
      await this.logAccess(secret.id, userId, 'read', false);
      throw new Error('Access denied');
    }

    if (secret.status !== 'active') {
      throw new Error(`Secret is ${secret.status}`);
    }

    let encryptedValue: string;

    if (version) {
      const { data: versionData } = await supabase
        .from('secret_versions')
        .select('encrypted_value')
        .eq('secret_id', secret.id)
        .eq('version_number', version)
        .single();

      if (!versionData) {
        throw new Error('Version not found');
      }

      encryptedValue = versionData.encrypted_value;
    } else {
      encryptedValue = secret.encrypted_value;
    }

    const decryptedValue = encryptionService.decryptField(encryptedValue);

    this.cache.set(cacheKey, {
      value: decryptedValue,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    await this.logAccess(secret.id, userId, 'read', true);

    return decryptedValue;
  }

  async updateSecret(
    name: string,
    newValue: string,
    userId?: string,
    reason?: string
  ): Promise<void> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', name)
      .single();

    if (!secret) {
      throw new Error('Secret not found');
    }

    const hasAccess = await this.checkAccess(name, userId, 'update');
    if (!hasAccess) {
      await this.logAccess(secret.id, userId, 'update', false);
      throw new Error('Access denied');
    }

    const encryptedValue = encryptionService.encryptField(newValue);
    const newVersion = secret.current_version + 1;

    await supabase
      .from('secret_versions')
      .update({ is_current: false })
      .eq('secret_id', secret.id)
      .eq('is_current', true);

    await supabase.from('secret_versions').insert({
      secret_id: secret.id,
      version_number: newVersion,
      encrypted_value: encryptedValue,
      is_current: true,
      created_by: userId,
      change_reason: reason,
    });

    await supabase
      .from('secrets')
      .update({
        encrypted_value: encryptedValue,
        current_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', secret.id);

    this.cache.delete(name);

    await this.logAccess(secret.id, userId, 'update', true);
  }

  async rotateSecret(name: string, userId?: string): Promise<void> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', name)
      .single();

    if (!secret) {
      throw new Error('Secret not found');
    }

    const hasAccess = await this.checkAccess(name, userId, 'rotate');
    if (!hasAccess) {
      await this.logAccess(secret.id, userId, 'rotate', false);
      throw new Error('Access denied');
    }

    const newValue = this.generateSecretValue(secret.secret_type);

    await supabase
      .from('secrets')
      .update({
        status: 'rotating',
        last_rotated_at: new Date().toISOString(),
      })
      .eq('id', secret.id);

    await this.updateSecret(name, newValue, userId, 'Automatic rotation');

    await supabase
      .from('secrets')
      .update({
        status: 'active',
      })
      .eq('id', secret.id);

    if (secret.rotation_enabled) {
      await this.scheduleRotation(secret.id);
    }

    await this.logAccess(secret.id, userId, 'rotate', true);
  }

  async revokeSecret(name: string, userId?: string): Promise<void> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', name)
      .single();

    if (!secret) {
      throw new Error('Secret not found');
    }

    const hasAccess = await this.checkAccess(name, userId, 'revoke');
    if (!hasAccess) {
      await this.logAccess(secret.id, userId, 'revoke', false);
      throw new Error('Access denied');
    }

    await supabase
      .from('secrets')
      .update({
        status: 'revoked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', secret.id);

    this.cache.delete(name);

    await this.logAccess(secret.id, userId, 'revoke', true);
  }

  async rollbackSecret(
    name: string,
    version: number,
    userId?: string
  ): Promise<void> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', name)
      .single();

    if (!secret) {
      throw new Error('Secret not found');
    }

    const { data: versionData } = await supabase
      .from('secret_versions')
      .select('encrypted_value')
      .eq('secret_id', secret.id)
      .eq('version_number', version)
      .single();

    if (!versionData) {
      throw new Error('Version not found');
    }

    const decryptedValue = encryptionService.decryptField(
      versionData.encrypted_value
    );

    await this.updateSecret(
      name,
      decryptedValue,
      userId,
      `Rollback to version ${version}`
    );
  }

  async listSecrets(userId?: string): Promise<Secret[]> {
    const { data, error } = await supabase
      .from('secrets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      name: row.name,
      secretType: row.secret_type,
      currentVersion: row.current_version,
      status: row.status,
      rotationEnabled: row.rotation_enabled,
      lastRotatedAt: new Date(row.last_rotated_at),
      nextRotationAt: row.next_rotation_at
        ? new Date(row.next_rotation_at)
        : undefined,
      createdAt: new Date(row.created_at),
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  async getSecretVersions(name: string): Promise<any[]> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('id')
      .eq('name', name)
      .single();

    if (!secret) {
      return [];
    }

    const { data } = await supabase
      .from('secret_versions')
      .select('*')
      .eq('secret_id', secret.id)
      .order('version_number', { ascending: false });

    return data || [];
  }

  private async checkAccess(
    secretName: string,
    userId?: string,
    operation: string = 'read'
  ): Promise<boolean> {
    if (!userId) {
      return false;
    }

    const { data } = await supabase.rpc('check_secret_access', {
      p_secret_name: secretName,
      p_user_id: userId,
      p_operation: operation,
    });

    return data || false;
  }

  private async logAccess(
    secretId: string | null,
    userId?: string,
    accessType: string = 'read',
    granted: boolean = false
  ): Promise<void> {
    try {
      if (secretId) {
        await supabase.rpc('log_secret_access', {
          p_secret_id: secretId,
          p_accessed_by: userId,
          p_access_type: accessType,
          p_granted: granted,
        });
      }
    } catch (error) {
      console.error('Failed to log secret access:', error);
    }
  }

  private async scheduleRotation(secretId: string): Promise<void> {
    await supabase.rpc('schedule_secret_rotation', {
      p_secret_id: secretId,
    });
  }

  private generateSecretValue(type: SecretType): string {
    switch (type) {
      case 'api_key':
        return `sk_${encryptionService.generateSecureToken(32)}`;
      case 'password':
        return this.generateStrongPassword();
      case 'encryption_key':
        return encryptionService.generateSecureToken(32);
      default:
        return encryptionService.generateSecureToken(32);
    }
  }

  private generateStrongPassword(): string {
    const length = 24;
    const charset =
      'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';

    let password = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      password += charset[randomIndex];
    }

    return password;
  }

  private assessRiskLevel(type: SecretType): string {
    const riskMap: Record<SecretType, string> = {
      password: 'medium',
      api_key: 'high',
      certificate: 'high',
      encryption_key: 'critical',
      database_password: 'critical',
      oauth_token: 'medium',
      ssh_key: 'high',
      generic: 'medium',
    };

    return riskMap[type] || 'medium';
  }

  private startRotationMonitoring(): void {
    setInterval(async () => {
      await this.checkPendingRotations();
    }, 60 * 60 * 1000);
  }

  private async checkPendingRotations(): Promise<void> {
    const { data: secrets } = await supabase.rpc(
      'get_secrets_requiring_rotation'
    );

    if (secrets && secrets.length > 0) {
      console.log(`Found ${secrets.length} secrets requiring rotation`);

      for (const secret of secrets) {
        try {
          await this.rotateSecret(secret.secret_name);
        } catch (error) {
          console.error(`Failed to rotate secret ${secret.secret_name}:`, error);
        }
      }
    }
  }

  private startCacheCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.cache.entries()) {
        if (now > value.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }
}

export const secretsVault = SecretsVault.getInstance();

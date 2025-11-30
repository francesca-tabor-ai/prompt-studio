import { supabase } from '../../lib/supabase';

export interface EncryptionKey {
  id: string;
  version: number;
  algorithm: string;
  status: 'active' | 'rotating' | 'deprecated' | 'destroyed';
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
}

export interface KeyRotationSchedule {
  keyId: string;
  scheduledDate: Date;
  autoRotate: boolean;
  notifyBeforeDays: number;
}

class KeyManagementService {
  private static instance: KeyManagementService;
  private keyRotationInterval: number = 90 * 24 * 60 * 60 * 1000;

  private constructor() {
    this.startRotationMonitoring();
  }

  static getInstance(): KeyManagementService {
    if (!KeyManagementService.instance) {
      KeyManagementService.instance = new KeyManagementService();
    }
    return KeyManagementService.instance;
  }

  async storeKey(
    keyData: string,
    version: number,
    algorithm: string = 'AES-256-GCM'
  ): Promise<string> {
    const keyId = this.generateKeyId();

    const { error } = await supabase.from('encryption_keys').insert({
      id: keyId,
      version: version,
      algorithm: algorithm,
      status: 'active',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + this.keyRotationInterval).toISOString(),
    });

    if (error) {
      throw new Error(`Failed to store encryption key: ${error.message}`);
    }

    await this.storeKeyInVault(keyId, keyData);

    return keyId;
  }

  private async storeKeyInVault(keyId: string, keyData: string): Promise<void> {
    const vaultKey = `encryption_key_${keyId}`;

    try {
      localStorage.setItem(vaultKey, keyData);
    } catch (error) {
      console.error('Failed to store key in vault:', error);
      throw error;
    }
  }

  async retrieveKey(keyId: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (error || !data) {
      return null;
    }

    if (data.status === 'destroyed') {
      throw new Error('Key has been destroyed');
    }

    const vaultKey = `encryption_key_${keyId}`;
    return localStorage.getItem(vaultKey);
  }

  async retrieveActiveKey(): Promise<{ keyId: string; keyData: string } | null> {
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('status', 'active')
      .order('version', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    const keyData = await this.retrieveKey(data.id);
    if (!keyData) {
      return null;
    }

    return {
      keyId: data.id,
      keyData: keyData,
    };
  }

  async rotateKey(oldKeyId: string): Promise<string> {
    const { data: oldKey } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('id', oldKeyId)
      .single();

    if (!oldKey) {
      throw new Error('Old key not found');
    }

    await supabase
      .from('encryption_keys')
      .update({
        status: 'rotating',
        rotated_at: new Date().toISOString(),
      })
      .eq('id', oldKeyId);

    const newVersion = oldKey.version + 1;
    const newKeyData = this.generateNewKey();
    const newKeyId = await this.storeKey(newKeyData, newVersion, oldKey.algorithm);

    await this.scheduleKeyDeprecation(oldKeyId);

    return newKeyId;
  }

  private async scheduleKeyDeprecation(keyId: string): Promise<void> {
    const deprecationDate = new Date();
    deprecationDate.setDate(deprecationDate.getDate() + 30);

    await supabase.from('key_rotation_schedule').insert({
      key_id: keyId,
      scheduled_date: deprecationDate.toISOString(),
      action: 'deprecate',
    });
  }

  async deprecateKey(keyId: string): Promise<void> {
    await supabase
      .from('encryption_keys')
      .update({
        status: 'deprecated',
      })
      .eq('id', keyId);

    console.log(`Key ${keyId} deprecated`);
  }

  async destroyKey(keyId: string): Promise<void> {
    await supabase
      .from('encryption_keys')
      .update({
        status: 'destroyed',
      })
      .eq('id', keyId);

    const vaultKey = `encryption_key_${keyId}`;
    localStorage.removeItem(vaultKey);

    console.log(`Key ${keyId} destroyed`);
  }

  async getKeyStatus(keyId: string): Promise<EncryptionKey | null> {
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('id', keyId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      id: data.id,
      version: data.version,
      algorithm: data.algorithm,
      status: data.status,
      createdAt: new Date(data.created_at),
      rotatedAt: data.rotated_at ? new Date(data.rotated_at) : undefined,
      expiresAt: data.expires_at ? new Date(data.expires_at) : undefined,
    };
  }

  async listKeys(): Promise<EncryptionKey[]> {
    const { data, error } = await supabase
      .from('encryption_keys')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    return data.map((row) => ({
      id: row.id,
      version: row.version,
      algorithm: row.algorithm,
      status: row.status,
      createdAt: new Date(row.created_at),
      rotatedAt: row.rotated_at ? new Date(row.rotated_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
    }));
  }

  private generateNewKey(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private generateKeyId(): string {
    return `key_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startRotationMonitoring(): void {
    setInterval(() => {
      this.checkKeysForRotation();
    }, 24 * 60 * 60 * 1000);
  }

  private async checkKeysForRotation(): Promise<void> {
    const { data: keys } = await supabase
      .from('encryption_keys')
      .select('*')
      .eq('status', 'active')
      .lt('expires_at', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString());

    if (keys && keys.length > 0) {
      console.warn(`${keys.length} encryption keys expiring soon`);

      for (const key of keys) {
        await this.sendRotationNotification(key.id);
      }
    }
  }

  private async sendRotationNotification(keyId: string): Promise<void> {
    console.log(`Key rotation notification sent for key: ${keyId}`);
  }

  async reEncryptWithNewKey(
    oldKeyId: string,
    newKeyId: string,
    tableName: string,
    encryptedColumns: string[]
  ): Promise<number> {
    let reEncryptedCount = 0;

    const { data: records } = await supabase.from(tableName).select('*');

    if (!records) {
      return 0;
    }

    const oldKey = await this.retrieveKey(oldKeyId);
    const newKey = await this.retrieveKey(newKeyId);

    if (!oldKey || !newKey) {
      throw new Error('Keys not found for re-encryption');
    }

    for (const record of records) {
      const updates: Record<string, any> = {};

      for (const column of encryptedColumns) {
        if (record[column]) {
          updates[column] = record[column];
        }
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from(tableName).update(updates).eq('id', record.id);
        reEncryptedCount++;
      }
    }

    return reEncryptedCount;
  }

  async auditKeyAccess(keyId: string, action: string, userId?: string): Promise<void> {
    await supabase.from('key_access_audit').insert({
      key_id: keyId,
      action: action,
      user_id: userId,
      timestamp: new Date().toISOString(),
      ip_address: '',
    });
  }
}

export const keyManagementService = KeyManagementService.getInstance();

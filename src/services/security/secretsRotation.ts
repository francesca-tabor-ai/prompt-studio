import { supabase } from '../../lib/supabase';
import { secretsVault } from './secretsVault';

export interface RotationConfig {
  secretId: string;
  rotationType: 'automatic' | 'manual' | 'emergency';
  notifyBeforeDays?: number;
}

export interface RotationResult {
  success: boolean;
  secretId: string;
  oldVersion: number;
  newVersion: number;
  rotatedAt: Date;
  error?: string;
}

class SecretsRotationService {
  private static instance: SecretsRotationService;

  private constructor() {}

  static getInstance(): SecretsRotationService {
    if (!SecretsRotationService.instance) {
      SecretsRotationService.instance = new SecretsRotationService();
    }
    return SecretsRotationService.instance;
  }

  async rotateSecret(
    secretName: string,
    userId?: string,
    rotationType: 'automatic' | 'manual' | 'emergency' = 'manual'
  ): Promise<RotationResult> {
    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('name', secretName)
      .single();

    if (!secret) {
      return {
        success: false,
        secretId: '',
        oldVersion: 0,
        newVersion: 0,
        rotatedAt: new Date(),
        error: 'Secret not found',
      };
    }

    const oldVersion = secret.current_version;

    try {
      await secretsVault.rotateSecret(secretName, userId);

      const { data: updatedSecret } = await supabase
        .from('secrets')
        .select('current_version')
        .eq('id', secret.id)
        .single();

      await supabase
        .from('secret_rotation_schedule')
        .update({
          completed: true,
          completed_at: new Date().toISOString(),
        })
        .eq('secret_id', secret.id)
        .eq('completed', false);

      return {
        success: true,
        secretId: secret.id,
        oldVersion,
        newVersion: updatedSecret?.current_version || oldVersion + 1,
        rotatedAt: new Date(),
      };
    } catch (error: any) {
      await supabase
        .from('secret_rotation_schedule')
        .update({
          failed: true,
          failure_reason: error.message,
        })
        .eq('secret_id', secret.id)
        .eq('completed', false);

      return {
        success: false,
        secretId: secret.id,
        oldVersion,
        newVersion: oldVersion,
        rotatedAt: new Date(),
        error: error.message,
      };
    }
  }

  async rotateAllDueSecrets(): Promise<RotationResult[]> {
    const { data: secrets } = await supabase.rpc(
      'get_secrets_requiring_rotation'
    );

    if (!secrets || secrets.length === 0) {
      return [];
    }

    const results: RotationResult[] = [];

    for (const secret of secrets) {
      const result = await this.rotateSecret(secret.secret_name, undefined, 'automatic');
      results.push(result);
    }

    return results;
  }

  async scheduleRotation(
    secretId: string,
    scheduledAt: Date,
    rotationType: 'automatic' | 'manual' | 'emergency' = 'automatic'
  ): Promise<string> {
    const { data, error } = await supabase
      .from('secret_rotation_schedule')
      .insert({
        secret_id: secretId,
        scheduled_at: scheduledAt.toISOString(),
        rotation_type: rotationType,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to schedule rotation: ${error.message}`);
    }

    return data.id;
  }

  async cancelScheduledRotation(scheduleId: string): Promise<void> {
    await supabase
      .from('secret_rotation_schedule')
      .delete()
      .eq('id', scheduleId)
      .eq('completed', false);
  }

  async getPendingRotations(): Promise<any[]> {
    const { data } = await supabase
      .from('secret_rotation_schedule')
      .select(
        `
        *,
        secrets:secret_id (
          name,
          secret_type,
          last_rotated_at
        )
      `
      )
      .eq('completed', false)
      .eq('failed', false)
      .order('scheduled_at', { ascending: true });

    return data || [];
  }

  async getRotationHistory(
    secretId: string,
    limit: number = 10
  ): Promise<any[]> {
    const { data } = await supabase
      .from('secret_rotation_schedule')
      .select('*')
      .eq('secret_id', secretId)
      .order('completed_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  async enableAutoRotation(
    secretId: string,
    intervalDays: number = 90
  ): Promise<void> {
    await supabase
      .from('secrets')
      .update({
        rotation_enabled: true,
        rotation_interval: `${intervalDays} days`,
      })
      .eq('id', secretId);

    const { data: secret } = await supabase
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .single();

    if (secret) {
      await supabase.rpc('schedule_secret_rotation', {
        p_secret_id: secretId,
      });
    }
  }

  async disableAutoRotation(secretId: string): Promise<void> {
    await supabase
      .from('secrets')
      .update({
        rotation_enabled: false,
        next_rotation_at: null,
      })
      .eq('id', secretId);

    await supabase
      .from('secret_rotation_schedule')
      .delete()
      .eq('secret_id', secretId)
      .eq('completed', false);
  }

  async notifyUpcomingRotations(daysAhead: number = 7): Promise<void> {
    const notifyDate = new Date();
    notifyDate.setDate(notifyDate.getDate() + daysAhead);

    const { data: upcomingRotations } = await supabase
      .from('secret_rotation_schedule')
      .select(
        `
        *,
        secrets:secret_id (
          name,
          secret_type
        )
      `
      )
      .eq('completed', false)
      .lte('scheduled_at', notifyDate.toISOString())
      .gte('scheduled_at', new Date().toISOString());

    if (upcomingRotations && upcomingRotations.length > 0) {
      console.log(
        `${upcomingRotations.length} secrets require rotation in the next ${daysAhead} days`
      );
    }
  }

  async emergencyRotateAll(pattern?: string): Promise<RotationResult[]> {
    let query = supabase.from('secrets').select('*').eq('status', 'active');

    if (pattern) {
      query = query.like('name', pattern);
    }

    const { data: secrets } = await query;

    if (!secrets || secrets.length === 0) {
      return [];
    }

    const results: RotationResult[] = [];

    for (const secret of secrets) {
      const result = await this.rotateSecret(secret.name, undefined, 'emergency');
      results.push(result);
    }

    return results;
  }

  async getRotationMetrics(): Promise<any> {
    const { data: allSecrets } = await supabase
      .from('secrets')
      .select('rotation_enabled, status')
      .eq('status', 'active');

    const { data: completedRotations } = await supabase
      .from('secret_rotation_schedule')
      .select('*')
      .eq('completed', true)
      .gte('completed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: failedRotations } = await supabase
      .from('secret_rotation_schedule')
      .select('*')
      .eq('failed', true)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const totalSecrets = allSecrets?.length || 0;
    const rotationEnabled = allSecrets?.filter((s) => s.rotation_enabled).length || 0;
    const completed = completedRotations?.length || 0;
    const failed = failedRotations?.length || 0;

    return {
      totalSecrets,
      rotationEnabled,
      rotationDisabled: totalSecrets - rotationEnabled,
      completedLast30Days: completed,
      failedLast30Days: failed,
      successRate: completed > 0 ? ((completed / (completed + failed)) * 100).toFixed(2) : 0,
    };
  }
}

export const secretsRotationService = SecretsRotationService.getInstance();

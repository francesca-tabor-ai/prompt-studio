import { supabase } from '../../lib/supabase';
import { sha256 } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

export interface WebhookSubscription {
  userId: string;
  eventType: string;
  callbackUrl: string;
  secretKey: string;
  filters?: Record<string, any>;
}

export interface WebhookEvent {
  type: string;
  data: any;
  timestamp: string;
}

class WebhookService {
  private static instance: WebhookService;

  private constructor() {
    this.startDeliveryWorker();
  }

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  async subscribe(subscription: WebhookSubscription): Promise<string> {
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        user_id: subscription.userId,
        event_type: subscription.eventType,
        callback_url: subscription.callbackUrl,
        secret_key: subscription.secretKey,
        filters: subscription.filters || {},
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create webhook subscription: ${error.message}`);
    }

    return data.id;
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    await supabase
      .from('webhook_subscriptions')
      .update({ active: false })
      .eq('id', subscriptionId);
  }

  async listSubscriptions(userId: string): Promise<any[]> {
    const { data } = await supabase
      .from('webhook_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true);

    return data || [];
  }

  async trigger(eventType: string, payload: any): Promise<number> {
    const { data } = await supabase.rpc('trigger_webhook', {
      p_event_type: eventType,
      p_payload: payload,
    });

    return data || 0;
  }

  async deliverWebhook(
    deliveryId: string,
    callbackUrl: string,
    secretKey: string,
    payload: any
  ): Promise<boolean> {
    try {
      const signature = this.generateSignature(payload, secretKey);

      const response = await fetch(callbackUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Timestamp': new Date().toISOString(),
        },
        body: JSON.stringify(payload),
      });

      const success = response.ok;

      await supabase
        .from('webhook_deliveries')
        .update({
          status: success ? 'delivered' : 'failed',
          attempts: supabase.rpc('increment', { x: 1 }),
          last_attempt_at: new Date().toISOString(),
          response_status: response.status,
          response_body: await response.text(),
          delivered_at: success ? new Date().toISOString() : null,
          failed_at: success ? null : new Date().toISOString(),
        })
        .eq('id', deliveryId);

      return success;
    } catch (error: any) {
      await supabase
        .from('webhook_deliveries')
        .update({
          status: 'retrying',
          attempts: supabase.rpc('increment', { x: 1 }),
          last_attempt_at: new Date().toISOString(),
          next_retry_at: this.calculateNextRetry(1),
          response_body: error.message,
        })
        .eq('id', deliveryId);

      return false;
    }
  }

  async getDeliveries(
    subscriptionId: string,
    limit: number = 50
  ): Promise<any[]> {
    const { data } = await supabase
      .from('webhook_deliveries')
      .select('*')
      .eq('subscription_id', subscriptionId)
      .order('created_at', { ascending: false })
      .limit(limit);

    return data || [];
  }

  verifySignature(payload: any, signature: string, secretKey: string): boolean {
    const expectedSignature = this.generateSignature(payload, secretKey);
    return signature === expectedSignature;
  }

  private generateSignature(payload: any, secretKey: string): string {
    const payloadString = JSON.stringify(payload);
    const message = `${payloadString}${secretKey}`;
    const hash = sha256(new TextEncoder().encode(message));
    return bytesToHex(hash);
  }

  private calculateNextRetry(attemptNumber: number): string {
    const delays = [60, 300, 900, 3600];
    const delay = delays[Math.min(attemptNumber, delays.length - 1)];
    return new Date(Date.now() + delay * 1000).toISOString();
  }

  private startDeliveryWorker(): void {
    setInterval(async () => {
      await this.processDeliveries();
    }, 30000);
  }

  private async processDeliveries(): Promise<void> {
    const { data: deliveries } = await supabase.rpc(
      'get_pending_webhook_deliveries',
      { p_limit: 100 }
    );

    if (!deliveries || deliveries.length === 0) {
      return;
    }

    for (const delivery of deliveries) {
      await this.deliverWebhook(
        delivery.delivery_id,
        delivery.callback_url,
        delivery.secret_key,
        delivery.payload
      );
    }
  }
}

export const webhookService = WebhookService.getInstance();

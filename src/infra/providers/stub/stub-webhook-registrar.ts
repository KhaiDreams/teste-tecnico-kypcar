import type { WebhookRegistrar } from '../../../core/ports/integrations';

export class StubWebhookRegistrar implements WebhookRegistrar {
  public async registerWebhook(input: {
    accessToken: string;
    url: string;
    events: string[];
  }): Promise<{ webhookId: string }> {
    return {
      webhookId: `stub-webhook-${Buffer.from(`${input.url}:${input.events.join(',')}`)
        .toString('base64url')
        .slice(0, 12)}`,
    };
  }
}

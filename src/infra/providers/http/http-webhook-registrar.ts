import type { WebhookRegistrar } from '../../../core/ports/integrations';
import { KypcarHttpClient } from './kypcar-http-client';

interface CreateWebhookResponse {
  id: string;
  url: string;
  created_at: string;
}

export class HttpWebhookRegistrar implements WebhookRegistrar {
  public constructor(private readonly client: KypcarHttpClient) {}

  public async registerWebhook(input: {
    accessToken: string;
    url: string;
    events: string[];
  }): Promise<{ webhookId: string }> {
    const response = await this.client.requestJson<CreateWebhookResponse>({
      method: 'POST',
      path: '/v1/exam/webhooks/',
      body: {
        url: input.url,
      },
    });

    return {
      webhookId: response.id,
    };
  }
}

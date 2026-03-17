import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';

import { webhookPayloadSchema } from '../schemas/webhook-schema';

interface WebhookRouteDeps {
  enqueueWebhookEvent: (input: { eventId: string; plate: string; occurredAt: string }) => void;
}

export async function webhookRoute(app: FastifyInstance, deps: WebhookRouteDeps): Promise<void> {
  app.post('/webhooks/kypcar', async (request, reply) => {
    const parsed = webhookPayloadSchema.safeParse(request.body);

    if (!parsed.success) {
      const messages = parsed.error.issues.map((i) => i.message).join('; ');
      request.log.warn({ issues: parsed.error.issues }, 'Invalid webhook payload');

      return reply.status(400).send({
        message: `Invalid plate: ${messages}`,
      });
    }

    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();

    deps.enqueueWebhookEvent({
      eventId,
      plate: parsed.data.plate,
      occurredAt,
    });

    request.log.info(
      {
        eventId,
        plate: parsed.data.plate,
      },
      'Webhook accepted',
    );

    return reply.status(202).send({
      status: 'accepted',
      eventId,
    });
  });
}

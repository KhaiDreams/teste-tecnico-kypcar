import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../../src/app';

describe('HTTP integration', () => {
  let app: Awaited<ReturnType<typeof buildApp>>['app'];

  beforeEach(async () => {
    const appFactory = await buildApp();
    app = appFactory.app;
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns health status', async () => {
    const response = await request(app.server).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('accepts valid webhook and processes event', async () => {
    const payload = {
      plate: 'ABC1234',
    };

    const webhookResponse = await request(app.server).post('/webhooks/kypcar').send(payload);

    expect(webhookResponse.status).toBe(202);
    expect(typeof webhookResponse.body.eventId).toBe('string');
    const eventId = webhookResponse.body.eventId as string;

    let foundStatus = 'processing';

    for (let i = 0; i < 20; i += 1) {
      const debugResponse = await request(app.server).get(`/debug/events/${eventId}`);

      if (debugResponse.status === 200 && debugResponse.body.status === 'completed') {
        foundStatus = debugResponse.body.status;
        break;
      }

      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    }

    expect(foundStatus).toBe('completed');
  });

  it('rejects invalid webhook payload', async () => {
    const response = await request(app.server).post('/webhooks/kypcar').send({
      plate: 'A',
    });

    expect(response.status).toBe(400);
  });
});

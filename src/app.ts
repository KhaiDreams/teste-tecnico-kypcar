import Fastify from 'fastify';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import {
  ProcessKypcarEventUseCase,
  BootstrapIntegrationUseCase,
} from './application/use-cases/flows';
import { env } from './config/env';
import { fastifyLoggerOptions } from './infra/logging/logger';
import { HttpAuthProvider } from './infra/providers/http/http-auth-provider';
import { KypcarHttpClient } from './infra/providers/http/kypcar-http-client';
import { HttpReservationProvider } from './infra/providers/http/http-reservation-provider';
import { HttpVehicleProvider } from './infra/providers/http/http-vehicle-provider';
import { HttpWebhookRegistrar } from './infra/providers/http/http-webhook-registrar';
import { StubAuthProvider } from './infra/providers/stub/stub-auth-provider';
import { StubReservationProvider } from './infra/providers/stub/stub-reservation-provider';
import { StubVehicleProvider } from './infra/providers/stub/stub-vehicle-provider';
import { StubWebhookRegistrar } from './infra/providers/stub/stub-webhook-registrar';
import { InMemoryJobQueue } from './infra/queue/in-memory-job-queue';
import { InMemoryProcessedEventStore } from './infra/repositories/in-memory-event-store';
import { registerErrorHandler } from './interfaces/http/error-handler';
import { debugRoute } from './interfaces/http/routes/debug-route';
import { healthRoute } from './interfaces/http/routes/health-route';
import { webhookRoute } from './interfaces/http/routes/webhook-route';

declare module 'fastify' {
  interface FastifyRequest {
    startTimeMs: number;
  }
}

export async function buildApp() {
  const app = Fastify({
    logger: fastifyLoggerOptions,
  }) as FastifyInstance;

  const processedEventStore = new InMemoryProcessedEventStore();
  const hasKypcarCredentials = Boolean(env.KYPCAR_EMAIL && env.KYPCAR_PASSWORD);
  const isTestRuntime = !!process.env.VITEST || process.env.NODE_ENV === 'test';
  const useRealKypcarProviders = hasKypcarCredentials && !isTestRuntime;

  const authProvider = useRealKypcarProviders
    ? new HttpAuthProvider({
        apiUrl: env.KYPCAR_API_URL,
        email: env.KYPCAR_EMAIL ?? '',
        password: env.KYPCAR_PASSWORD ?? '',
      })
    : new StubAuthProvider();

  const kypcarClient = useRealKypcarProviders
    ? new KypcarHttpClient({
        baseUrl: env.KYPCAR_API_URL,
        timeoutMs: env.KYPCAR_HTTP_TIMEOUT_MS,
        retryMaxAttempts: env.KYPCAR_RETRY_MAX_ATTEMPTS,
        retryBaseDelayMs: env.KYPCAR_RETRY_BASE_DELAY_MS,
        authProvider,
        log: app.log,
      })
    : null;

  const webhookRegistrar = kypcarClient
    ? new HttpWebhookRegistrar(kypcarClient)
    : new StubWebhookRegistrar();
  const vehicleProvider = kypcarClient
    ? new HttpVehicleProvider(kypcarClient)
    : new StubVehicleProvider();
  const reservationProvider = kypcarClient
    ? new HttpReservationProvider(kypcarClient)
    : new StubReservationProvider();

  const processEventUseCase = new ProcessKypcarEventUseCase({
    vehicleProvider,
    reservationProvider,
    processedEventStore,
    timeoutMs: env.PROCESSING_TIMEOUT_MS,
    log: app.log,
  });

  const queue = new InMemoryJobQueue((event) => processEventUseCase.execute(event), app.log);

  app.addHook('onRequest', async (request: FastifyRequest, _reply) => {
    void _reply;
    request.startTimeMs = Date.now();
  });

  app.addHook('onResponse', async (request, reply) => {
    const durationMs = Date.now() - request.startTimeMs;

    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        durationMs,
      },
      'Request completed',
    );
  });

  await healthRoute(app);
  await webhookRoute(app, {
    enqueueWebhookEvent: (input) => queue.enqueue(input),
  });
  await debugRoute(app, {
    processedEventStore,
  });

  registerErrorHandler(app);

  if (env.AUTO_REGISTER_WEBHOOK) {
    if (!useRealKypcarProviders) {
      app.log.warn(
        'AUTO_REGISTER_WEBHOOK=true but real providers are disabled in this runtime; using stub providers',
      );
    }

    const bootstrapIntegrationUseCase = new BootstrapIntegrationUseCase(
      authProvider,
      webhookRegistrar,
      `${env.WEBHOOK_BASE_URL}/webhooks/kypcar`,
      app.log,
    );

    try {
      await bootstrapIntegrationUseCase.execute();
    } catch (error) {
      app.log.error(
        {
          error: error instanceof Error ? error.message : String(error),
        },
        'Failed to run initial webhook registration',
      );
    }
  }

  return {
    app,
    dependencies: {
      processedEventStore,
      reservationProvider,
    },
  };
}

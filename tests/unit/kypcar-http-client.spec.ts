import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AuthSession } from '../../src/core/domain/types';
import type { AppLogger } from '../../src/core/ports/logger';
import type { AuthProvider } from '../../src/core/ports/integrations';
import { KypcarHttpClient } from '../../src/infra/providers/http/kypcar-http-client';

interface MockResponseInit {
  status: number;
  body?: unknown;
}

function mockResponse(init: MockResponseInit): Response {
  return {
    ok: init.status >= 200 && init.status < 300,
    status: init.status,
    statusText: 'OK',
    json: async () => init.body,
    text: async () => JSON.stringify(init.body ?? {}),
  } as Response;
}

function createLogger(): AppLogger {
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };

  return logger;
}

function createAuthProvider(): AuthProvider {
  const makeSession = (accessToken: string, refreshToken: string): AuthSession => ({
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + 60_000).toISOString(),
  });

  return {
    authenticate: vi.fn(async () => makeSession('token-a', 'refresh-a')),
    refreshSession: vi.fn(async () => makeSession('token-b', 'refresh-b')),
  };
}

describe('KypcarHttpClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retries transient errors and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockResponse({ status: 500, body: { message: 'internal' } }))
      .mockResolvedValueOnce(mockResponse({ status: 200, body: { ok: true } }));

    vi.stubGlobal('fetch', fetchMock);

    const authProvider = createAuthProvider();
    const client = new KypcarHttpClient({
      baseUrl: 'https://dev.api.kypcar.com',
      timeoutMs: 3_000,
      retryMaxAttempts: 2,
      retryBaseDelayMs: 1,
      authProvider,
      log: createLogger(),
    });

    const response = await client.requestJson<{ ok: boolean }>({
      method: 'GET',
      path: '/v1/exam/vehicles/',
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('refreshes token on 401 and retries request once', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          status: 401,
          body: { message: 'unauthorized' },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          status: 200,
          body: { ok: true },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const authProvider = createAuthProvider();
    const client = new KypcarHttpClient({
      baseUrl: 'https://dev.api.kypcar.com',
      timeoutMs: 3_000,
      retryMaxAttempts: 1,
      retryBaseDelayMs: 1,
      authProvider,
      log: createLogger(),
    });

    const response = await client.requestJson<{ ok: boolean }>({
      method: 'GET',
      path: '/v1/exam/vehicles/',
    });

    expect(response.ok).toBe(true);
    expect((authProvider.refreshSession as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpAuthProvider } from '../../src/infra/providers/http/http-auth-provider';

interface MockResponseInit {
  status?: number;
  body?: unknown;
}

function mockResponse(init: MockResponseInit): Response {
  return {
    ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
    status: init.status ?? 200,
    statusText: 'OK',
    json: async () => init.body,
  } as Response;
}

function createJwt(expInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + expInSeconds,
    }),
  ).toString('base64url');

  return `header.${payload}.signature`;
}

describe('HttpAuthProvider', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('caches login token while still valid', async () => {
    const fetchMock = vi.fn(async () =>
      mockResponse({
        body: {
          access_token: createJwt(3600),
          refresh_token: 'refresh-1',
          token_type: 'bearer',
        },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const provider = new HttpAuthProvider({
      apiUrl: 'https://dev.api.kypcar.com',
      email: 'test@example.com',
      password: 'secret',
    });

    const session1 = await provider.authenticate();
    const session2 = await provider.authenticate();

    expect(session1.accessToken).toBe(session2.accessToken);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes token using refresh endpoint', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            access_token: createJwt(2),
            refresh_token: 'refresh-old',
            token_type: 'bearer',
          },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          body: {
            access_token: createJwt(3600),
            refresh_token: 'refresh-new',
            token_type: 'bearer',
          },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);

    const provider = new HttpAuthProvider({
      apiUrl: 'https://dev.api.kypcar.com',
      email: 'test@example.com',
      password: 'secret',
    });

    const first = await provider.authenticate();
    const refreshed = await provider.refreshSession();

    expect(first.refreshToken).toBe('refresh-old');
    expect(refreshed.refreshToken).toBe('refresh-new');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

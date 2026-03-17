import type { AuthSession } from '../../../core/domain/types';
import type { AuthProvider } from '../../../core/ports/integrations';

interface LoginOrRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export class HttpAuthProvider implements AuthProvider {
  private readonly loginUrl: string;
  private readonly refreshUrl: string;
  private readonly email: string;
  private readonly password: string;

  private cachedSession: AuthSession | null = null;
  private inflightAuth: Promise<AuthSession> | null = null;

  public constructor(options: { apiUrl: string; email: string; password: string }) {
    this.loginUrl = `${options.apiUrl}/v1/exam/auth/login`;
    this.refreshUrl = `${options.apiUrl}/v1/exam/auth/refresh`;
    this.email = options.email;
    this.password = options.password;
  }

  public async authenticate(): Promise<AuthSession> {
    if (this.cachedSession && !this.isExpiring(this.cachedSession)) {
      return this.cachedSession;
    }

    if (this.cachedSession?.refreshToken) {
      try {
        return await this.refreshSession();
      } catch {
        // Fall back to login when refresh fails.
      }
    }

    return this.runSingleflight(() => this.login());
  }

  public async refreshSession(): Promise<AuthSession> {
    if (!this.cachedSession?.refreshToken) {
      return this.runSingleflight(() => this.login());
    }

    return this.runSingleflight(async () => {
      const response = await fetch(this.refreshUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.cachedSession?.refreshToken }),
      });

      if (!response.ok) {
        throw new Error(`Kypcar refresh failed: ${response.status} ${response.statusText}`);
      }

      const body = (await response.json()) as LoginOrRefreshResponse;

      this.cachedSession = {
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: this.extractExpiry(body.access_token).toISOString(),
      };

      return this.cachedSession;
    });
  }

  private async login(): Promise<AuthSession> {
    const response = await fetch(this.loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
    });

    if (!response.ok) {
      throw new Error(`Kypcar authentication failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as LoginOrRefreshResponse;

    this.cachedSession = {
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
      expiresAt: this.extractExpiry(body.access_token).toISOString(),
    };

    return this.cachedSession;
  }

  private async runSingleflight(action: () => Promise<AuthSession>): Promise<AuthSession> {
    if (this.inflightAuth) {
      return this.inflightAuth;
    }

    this.inflightAuth = action().finally(() => {
      this.inflightAuth = null;
    });

    return this.inflightAuth;
  }

  private isExpiring(session: AuthSession): boolean {
    const marginMs = 60_000;
    return Date.now() + marginMs >= new Date(session.expiresAt).getTime();
  }

  private extractExpiry(jwt: string): Date {
    try {
      const parts = jwt.split('.');
      const payloadB64 = parts[1];

      if (!payloadB64) {
        throw new Error('invalid jwt');
      }

      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
        exp?: number;
      };

      if (typeof payload.exp === 'number') {
        return new Date(payload.exp * 1000);
      }
    } catch {
      // Fall through to default.
    }

    return new Date(Date.now() + 30 * 60 * 1000);
  }
}

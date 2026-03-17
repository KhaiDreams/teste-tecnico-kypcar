import type { AuthProvider } from '../../../core/ports/integrations';
import type { AuthSession } from '../../../core/domain/types';

export class StubAuthProvider implements AuthProvider {
  public async authenticate(): Promise<AuthSession> {
    return this.buildSession();
  }

  public async refreshSession(): Promise<AuthSession> {
    return this.buildSession();
  }

  private buildSession(): AuthSession {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 30);

    return {
      accessToken: 'stub-token',
      refreshToken: 'stub-refresh-token',
      expiresAt: expiresAt.toISOString(),
    };
  }
}

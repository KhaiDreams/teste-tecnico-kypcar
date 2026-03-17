import type { AppLogger } from '../../../core/ports/logger';
import type { AuthProvider } from '../../../core/ports/integrations';

interface RequestOptions {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  body?: unknown;
}

interface KypcarHttpClientOptions {
  baseUrl: string;
  timeoutMs: number;
  retryMaxAttempts: number;
  retryBaseDelayMs: number;
  authProvider: AuthProvider;
  log: AppLogger;
}

export class KypcarHttpClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly retryMaxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly authProvider: AuthProvider;
  private readonly log: AppLogger;

  public constructor(options: KypcarHttpClientOptions) {
    this.baseUrl = options.baseUrl;
    this.timeoutMs = options.timeoutMs;
    this.retryMaxAttempts = options.retryMaxAttempts;
    this.retryBaseDelayMs = options.retryBaseDelayMs;
    this.authProvider = options.authProvider;
    this.log = options.log;
  }

  public async requestJson<T>(options: RequestOptions): Promise<T> {
    const session = await this.authProvider.authenticate();

    try {
      return await this.executeWithRetry<T>(options, session.accessToken);
    } catch (error) {
      if (error instanceof Error && this.isUnauthorizedError(error)) {
        const refreshed = await this.authProvider.refreshSession();
        return this.executeWithRetry<T>(options, refreshed.accessToken);
      }

      throw error;
    }
  }

  private async executeWithRetry<T>(options: RequestOptions, accessToken: string): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.retryMaxAttempts; attempt += 1) {
      try {
        return await this.executeOnce<T>(options, accessToken);
      } catch (error) {
        if (!(error instanceof Error)) {
          throw error;
        }

        lastError = error;

        if (this.isUnauthorizedError(error)) {
          throw error;
        }

        if (!this.isRetryable(error) || attempt === this.retryMaxAttempts) {
          throw error;
        }

        const backoffMs = this.retryBaseDelayMs * 2 ** (attempt - 1);
        this.log.warn(
          {
            attempt,
            backoffMs,
            path: options.path,
            method: options.method,
            error: error.message,
          },
          'Retrying Kypcar API request',
        );

        await this.delay(backoffMs);
      }
    }

    throw lastError ?? new Error('Kypcar request failed');
  }

  private async executeOnce<T>(options: RequestOptions, accessToken: string): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const requestInit: RequestInit = {
        method: options.method,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      };

      if (options.body) {
        requestInit.body = JSON.stringify(options.body);
      }

      const response = await fetch(`${this.baseUrl}${options.path}`, {
        ...requestInit,
      });

      if (!response.ok) {
        const responseText = await response.text();
        const error = new Error(
          `Kypcar API request failed (${response.status}): ${responseText}`,
        ) as Error & { statusCode?: number };

        error.statusCode = response.status;
        throw error;
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new Error(
          `Kypcar API request timeout after ${this.timeoutMs}ms`,
        ) as Error & { statusCode?: number };
        timeoutError.statusCode = 408;
        throw timeoutError;
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(error: Error): boolean {
    const statusCode =
      'statusCode' in error && typeof error.statusCode === 'number' ? error.statusCode : undefined;

    if (!statusCode) {
      return true;
    }

    return statusCode === 408 || statusCode === 429 || statusCode >= 500;
  }

  private isUnauthorizedError(error: Error): boolean {
    return 'statusCode' in error && error.statusCode === 401;
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

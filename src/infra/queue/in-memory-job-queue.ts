import type { KypcarWebhookEvent } from '../../core/domain/types';
import type { AppLogger } from '../../core/ports/logger';

export class InMemoryJobQueue {
  private readonly jobs: KypcarWebhookEvent[] = [];
  private isProcessing = false;

  public constructor(
    private readonly handler: (event: KypcarWebhookEvent) => Promise<void>,
    private readonly log: AppLogger,
  ) {}

  public enqueue(event: KypcarWebhookEvent): void {
    this.jobs.push(event);

    if (!this.isProcessing) {
      void this.processLoop();
    }
  }

  private async processLoop(): Promise<void> {
    this.isProcessing = true;

    while (this.jobs.length > 0) {
      const current = this.jobs.shift();

      if (!current) {
        continue;
      }

      try {
        await this.handler(current);
      } catch (error) {
        this.log.error(
          {
            error: error instanceof Error ? error.message : String(error),
            eventId: current.eventId,
          },
          'Unexpected queue processing error',
        );
      }
    }

    this.isProcessing = false;
  }
}

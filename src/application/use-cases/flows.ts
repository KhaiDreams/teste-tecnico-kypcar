import type { KypcarWebhookEvent } from '../../core/domain/types';
import type { AppLogger } from '../../core/ports/logger';
import type {
  AuthProvider,
  ReservationProvider,
  VehicleProvider,
  WebhookRegistrar,
} from '../../core/ports/integrations';
import type { ProcessedEventStore } from '../../core/ports/repositories';

export class BootstrapIntegrationUseCase {
  public constructor(
    private readonly authProvider: AuthProvider,
    private readonly webhookRegistrar: WebhookRegistrar,
    private readonly webhookUrl: string,
    private readonly log: AppLogger,
  ) {}

  public async execute(): Promise<void> {
    const session = await this.authProvider.authenticate();

    const registration = await this.webhookRegistrar.registerWebhook({
      accessToken: session.accessToken,
      url: this.webhookUrl,
      events: ['vehicle_plate_detected'],
    });

    this.log.info(
      {
        webhookId: registration.webhookId,
        webhookUrl: this.webhookUrl,
      },
      'Webhook registration completed',
    );
  }
}

export interface ProcessEventDependencies {
  vehicleProvider: VehicleProvider;
  reservationProvider: ReservationProvider;
  processedEventStore: ProcessedEventStore;
  timeoutMs: number;
  log: AppLogger;
}

export class ProcessKypcarEventUseCase {
  public constructor(private readonly deps: ProcessEventDependencies) {}

  public async execute(event: KypcarWebhookEvent): Promise<void> {
    const existing = await this.deps.processedEventStore.get(event.eventId);

    if (existing?.status === 'completed' || existing?.status === 'processing') {
      this.deps.log.info(
        { eventId: event.eventId, status: existing.status },
        'Ignoring duplicated event',
      );
      return;
    }

    const startedAt = new Date();
    const attempts = (existing?.attempts ?? 0) + 1;

    await this.deps.processedEventStore.set({
      eventId: event.eventId,
      plate: event.plate,
      status: 'processing',
      receivedAt: event.occurredAt,
      startedAt: startedAt.toISOString(),
      attempts,
    });

    try {
      const result = await this.withTimeout(this.process(event), this.deps.timeoutMs);
      const finishedAt = new Date();

      await this.deps.processedEventStore.set({
        eventId: event.eventId,
        plate: event.plate,
        status: 'completed',
        receivedAt: event.occurredAt,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        attempts,
        vehicleId: result.vehicleId,
        reservationId: result.reservationId,
      });

      this.deps.log.info(
        { eventId: event.eventId, reservationId: result.reservationId },
        'Event processed',
      );
    } catch (error) {
      const finishedAt = new Date();
      const errorMessage = error instanceof Error ? error.message : String(error);

      await this.deps.processedEventStore.set({
        eventId: event.eventId,
        plate: event.plate,
        status: 'failed',
        receivedAt: event.occurredAt,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        attempts,
        error: errorMessage,
      });

      this.deps.log.error(
        { eventId: event.eventId, error: errorMessage },
        'Event processing failed',
      );
    }
  }

  private async process(
    event: KypcarWebhookEvent,
  ): Promise<{ vehicleId: string; reservationId: string }> {
    const vehicle = await this.deps.vehicleProvider.getByPlate({
      plate: event.plate,
    });

    const toDateString = (d: Date) => d.toISOString().substring(0, 10);
    const startsAt = toDateString(new Date());
    const endsAt = toDateString(new Date(Date.now() + 24 * 60 * 60 * 1000));

    const reservation = await this.deps.reservationProvider.createReservation({
      vehicleId: vehicle.id,
      startsAt,
      endsAt,
      sourceEventId: event.eventId,
    });

    return {
      vehicleId: vehicle.id,
      reservationId: reservation.id,
    };
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Processing timeout (${timeoutMs}ms) reached`));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }
}

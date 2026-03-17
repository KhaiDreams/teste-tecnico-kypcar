import { describe, expect, it, vi } from 'vitest';

import { ProcessKypcarEventUseCase } from '../../src/application/use-cases/flows';
import type { KypcarWebhookEvent, ProcessedEventRecord } from '../../src/core/domain/types';
import type { AppLogger } from '../../src/core/ports/logger';
import type { ProcessedEventStore } from '../../src/core/ports/repositories';

class InMemoryStore implements ProcessedEventStore {
  private readonly map = new Map<string, ProcessedEventRecord>();

  public async get(eventId: string): Promise<ProcessedEventRecord | undefined> {
    return this.map.get(eventId);
  }

  public async set(record: ProcessedEventRecord): Promise<void> {
    this.map.set(record.eventId, record);
  }
}

function createTestLogger(): AppLogger {
  const logger: AppLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => logger),
  };

  return logger;
}

describe('ProcessKypcarEventUseCase', () => {
  const baseEvent: KypcarWebhookEvent = {
    eventId: 'EVT-123',
    plate: 'ABC1234',
    occurredAt: new Date().toISOString(),
  };

  it('processes event and stores completed status', async () => {
    const store = new InMemoryStore();
    const getByPlate = vi.fn(async () => ({
      id: 'veh-abc1234',
      plate: 'ABC1234',
      brand: 'Kypcar',
      model: 'Stub',
      year: 2026,
    }));
    const createReservation = vi.fn(
      async (input: {
        vehicleId: string;
        startsAt: string;
        endsAt: string;
        sourceEventId: string;
      }) => ({
        id: 'res-1',
        vehicleId: input.vehicleId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        sourceEventId: input.sourceEventId,
      }),
    );

    const useCase = new ProcessKypcarEventUseCase({
      vehicleProvider: { getByPlate },
      reservationProvider: { createReservation },
      processedEventStore: store,
      timeoutMs: 60_000,
      log: createTestLogger(),
    });

    await useCase.execute(baseEvent);

    const record = await store.get(baseEvent.eventId);

    expect(record?.status).toBe('completed');
    expect(record?.reservationId).toBe('res-1');
    expect(getByPlate).toHaveBeenCalledTimes(1);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });

  it('ignores duplicated completed event', async () => {
    const store = new InMemoryStore();
    const getByPlate = vi.fn(async () => ({
      id: 'veh-abc1234',
      plate: 'ABC1234',
      brand: 'Kypcar',
      model: 'Stub',
      year: 2026,
    }));
    const createReservation = vi.fn(
      async (input: {
        vehicleId: string;
        startsAt: string;
        endsAt: string;
        sourceEventId: string;
      }) => ({
        id: 'res-1',
        vehicleId: input.vehicleId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        sourceEventId: input.sourceEventId,
      }),
    );

    const useCase = new ProcessKypcarEventUseCase({
      vehicleProvider: { getByPlate },
      reservationProvider: { createReservation },
      processedEventStore: store,
      timeoutMs: 60_000,
      log: createTestLogger(),
    });

    await useCase.execute(baseEvent);
    await useCase.execute(baseEvent);

    expect(getByPlate).toHaveBeenCalledTimes(1);
    expect(createReservation).toHaveBeenCalledTimes(1);
  });
});

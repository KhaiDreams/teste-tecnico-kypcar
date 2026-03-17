import type { ProcessedEventRecord } from '../../core/domain/types';
import type { ProcessedEventStore } from '../../core/ports/repositories';

export class InMemoryProcessedEventStore implements ProcessedEventStore {
  private readonly records = new Map<string, ProcessedEventRecord>();

  public async get(eventId: string): Promise<ProcessedEventRecord | undefined> {
    return this.records.get(eventId);
  }

  public async set(record: ProcessedEventRecord): Promise<void> {
    this.records.set(record.eventId, record);
  }
}

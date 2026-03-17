import type { ProcessedEventRecord } from '../domain/types';

export interface ProcessedEventStore {
  get(eventId: string): Promise<ProcessedEventRecord | undefined>;
  set(record: ProcessedEventRecord): Promise<void>;
}

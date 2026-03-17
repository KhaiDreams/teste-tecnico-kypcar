export interface KypcarWebhookEvent {
  eventId: string;
  plate: string;
  occurredAt: string;
}

export interface VehicleInfo {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: number;
}

export interface ReservationInfo {
  id: string;
  vehicleId: string;
  startsAt: string;
  endsAt: string;
  sourceEventId: string;
}

export type ProcessingStatus = 'processing' | 'completed' | 'failed';

export interface ProcessedEventRecord {
  eventId: string;
  plate: string;
  status: ProcessingStatus;
  receivedAt: string;
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  attempts: number;
  vehicleId?: string;
  reservationId?: string;
  error?: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

import type { AuthSession, ReservationInfo, VehicleInfo } from '../domain/types';

export interface AuthProvider {
  authenticate(): Promise<AuthSession>;
  refreshSession(): Promise<AuthSession>;
}

export interface WebhookRegistrar {
  registerWebhook(input: {
    accessToken: string;
    url: string;
    events: string[];
  }): Promise<{ webhookId: string }>;
}

export interface VehicleProvider {
  getByPlate(input: { plate: string; accessToken?: string }): Promise<VehicleInfo>;
}

export interface ReservationProvider {
  createReservation(input: {
    vehicleId: string;
    startsAt: string;
    endsAt: string;
    sourceEventId: string;
    accessToken?: string;
  }): Promise<ReservationInfo>;
}

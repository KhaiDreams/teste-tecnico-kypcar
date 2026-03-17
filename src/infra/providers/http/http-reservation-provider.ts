import type { ReservationInfo } from '../../../core/domain/types';
import type { ReservationProvider } from '../../../core/ports/integrations';
import { KypcarHttpClient } from './kypcar-http-client';

interface CreateReservationResponse {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
}

export class HttpReservationProvider implements ReservationProvider {
  public constructor(private readonly client: KypcarHttpClient) {}

  public async createReservation(input: {
    vehicleId: string;
    startsAt: string;
    endsAt: string;
    sourceEventId: string;
  }): Promise<ReservationInfo> {
    const response = await this.client.requestJson<CreateReservationResponse>({
      method: 'POST',
      path: '/v1/exam/reservations/',
      body: {
        vehicle_id: input.vehicleId,
        start_date: input.startsAt,
        end_date: input.endsAt,
      },
    });

    return {
      id: response.id,
      vehicleId: response.vehicle_id,
      startsAt: response.start_date,
      endsAt: response.end_date,
      sourceEventId: input.sourceEventId,
    };
  }
}

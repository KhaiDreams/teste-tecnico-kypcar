import type { ReservationInfo } from '../../../core/domain/types';
import type { ReservationProvider } from '../../../core/ports/integrations';

export class StubReservationProvider implements ReservationProvider {
  public calls = 0;

  public async createReservation(input: {
    vehicleId: string;
    startsAt: string;
    endsAt: string;
    sourceEventId: string;
  }): Promise<ReservationInfo> {
    this.calls += 1;

    return {
      id: `res-${input.sourceEventId.toLowerCase()}`,
      vehicleId: input.vehicleId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      sourceEventId: input.sourceEventId,
    };
  }
}

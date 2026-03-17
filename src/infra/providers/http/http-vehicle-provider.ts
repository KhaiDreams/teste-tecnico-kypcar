import type { VehicleInfo } from '../../../core/domain/types';
import type { VehicleProvider } from '../../../core/ports/integrations';
import { KypcarHttpClient } from './kypcar-http-client';

interface VehiclesListResponse {
  items: Array<{
    id: string;
    plate: string;
    brand: string;
    model: string;
    year: number;
  }>;
  total: number;
  limit: number;
  offset: number;
}

export class HttpVehicleProvider implements VehicleProvider {
  public constructor(private readonly client: KypcarHttpClient) {}

  public async getByPlate(input: { plate: string }): Promise<VehicleInfo> {
    const response = await this.client.requestJson<VehiclesListResponse>({
      method: 'GET',
      path: `/v1/exam/vehicles/?plate=${encodeURIComponent(input.plate)}`,
    });

    const match = response.items.find(
      (vehicle) => vehicle.plate.toUpperCase() === input.plate.toUpperCase(),
    );

    if (!match) {
      throw new Error(`Vehicle not found for plate: ${input.plate}`);
    }

    return {
      id: match.id,
      plate: match.plate,
      brand: match.brand,
      model: match.model,
      year: match.year,
    };
  }
}

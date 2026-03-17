import type { VehicleInfo } from '../../../core/domain/types';
import type { VehicleProvider } from '../../../core/ports/integrations';

export class StubVehicleProvider implements VehicleProvider {
  public async getByPlate(input: { plate: string }): Promise<VehicleInfo> {
    return {
      id: `veh-${input.plate.toLowerCase()}`,
      plate: input.plate.toUpperCase(),
      brand: 'Kypcar',
      model: 'Integration Stub',
      year: new Date().getUTCFullYear(),
    };
  }
}

import type { TelecomProvider, ProvisionResult } from "../telecom";

export interface CreateRentalInput {
  accountId: string;
  phoneNumber: string;
  webhookUrl: string;
}

export class RentalsService {
  constructor(private provider: TelecomProvider) {}

  async create(input: CreateRentalInput): Promise<{
    rentalId: string;
    provision: ProvisionResult;
  }> {
    const provision = await this.provider.provisionNumber({
      phoneNumber: input.phoneNumber,
      webhookUrl: input.webhookUrl,
    });

    // In the real system this will insert into the rentals table
    // and link the number. For now we return a simulated rental id.
    const rentalId = `rental_${Date.now()}`;

    return { rentalId, provision };
  }
}
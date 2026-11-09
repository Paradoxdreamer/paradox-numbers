import type { TelecomProvider, AvailableNumber } from "../telecom";

export class NumbersService {
  constructor(private provider: TelecomProvider) {}

  async search(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    return this.provider.searchNumbers(params);
  }
}
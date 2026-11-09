import type {
  TelecomProvider,
  AvailableNumber,
  ProvisionResult,
} from "../provider.interface";

/**
 * Simulated provider for development and testing.
 * Never talks to real carriers. Returns fake data.
 */
export class MockProvider implements TelecomProvider {
  readonly name = "mock";

  private inventory: AvailableNumber[] = [
    {
      phoneNumber: "+15551234567",
      countryCode: "US",
      areaCode: "555",
      capabilities: ["sms"],
      monthlyCostCents: 100,
    },
    {
      phoneNumber: "+15559876543",
      countryCode: "US",
      areaCode: "555",
      capabilities: ["sms", "voice"],
      monthlyCostCents: 150,
    },
    {
      phoneNumber: "+12125550100",
      countryCode: "US",
      areaCode: "212",
      capabilities: ["sms"],
      monthlyCostCents: 120,
    },
  ];

  async searchNumbers(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    let results = this.inventory.filter(
      (n) => n.countryCode === params.countryCode
    );

    if (params.areaCode) {
      results = results.filter((n) => n.areaCode === params.areaCode);
    }

    if (params.capabilities?.length) {
      results = results.filter((n) =>
        params.capabilities!.every((c) => n.capabilities.includes(c))
      );
    }

    return results.slice(0, params.limit ?? 20);
  }

  async provisionNumber(params: {
    phoneNumber: string;
    webhookUrl: string;
  }): Promise<ProvisionResult> {
    const exists = this.inventory.find((n) => n.phoneNumber === params.phoneNumber);
    if (!exists) {
      throw new Error(`Number ${params.phoneNumber} not available`);
    }

    // Remove from available inventory
    this.inventory = this.inventory.filter((n) => n.phoneNumber !== params.phoneNumber);

    return {
      providerNumberId: `mock_${Date.now()}`,
      phoneNumber: params.phoneNumber,
      status: "provisioned",
    };
  }

  async releaseNumber(params: {
    phoneNumber: string;
    providerNumberId?: string;
  }): Promise<{ success: boolean }> {
    // In a real system this would call the provider. For mock we just succeed.
    return { success: true };
  }
}
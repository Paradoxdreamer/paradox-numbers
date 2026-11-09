// Provider-agnostic telecom interface for Paradox Numbers
// All real providers (Telnyx, Twilio, etc.) implement this contract.

export interface AvailableNumber {
  phoneNumber: string;
  countryCode: string;
  areaCode: string | null;
  capabilities: ("sms" | "voice" | "mms")[];
  monthlyCostCents: number;
  providerData?: Record<string, unknown>;
}

export interface ProvisionResult {
  providerNumberId: string;
  phoneNumber: string;
  status: "provisioned" | "pending";
}

export interface IncomingMessage {
  from: string;
  to: string;
  body: string;
  providerMessageId: string;
  receivedAt: string;
  raw: unknown;
}

export interface TelecomProvider {
  readonly name: string;

  searchNumbers(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]>;

  provisionNumber(params: {
    phoneNumber: string;
    webhookUrl: string;
  }): Promise<ProvisionResult>;

  releaseNumber(params: {
    phoneNumber: string;
    providerNumberId?: string;
  }): Promise<{ success: boolean }>;

  // Optional for now — outbound later
  // sendSms?(params: { from: string; to: string; body: string }): Promise<{ providerMessageId: string }>;
}

export interface WebhookVerifier {
  verify(payload: string | Buffer, signature: string, secret: string): boolean;
  parseIncoming(payload: unknown): IncomingMessage | null;
}
import type { TelecomProvider } from "./provider.interface";
import { MockProvider } from "./providers/mock.provider";

export type ProviderName = "mock" | "telnyx" | "twilio";

const providers: Record<ProviderName, () => TelecomProvider> = {
  mock: () => new MockProvider(),
  telnyx: () => {
    throw new Error("Telnyx provider not implemented yet");
  },
  twilio: () => {
    throw new Error("Twilio provider not implemented yet");
  },
};

export function getProvider(name: ProviderName = "mock"): TelecomProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return factory();
}

export type { TelecomProvider, AvailableNumber, ProvisionResult, IncomingMessage } from "./provider.interface";
export { MockProvider } from "./providers/mock.provider";
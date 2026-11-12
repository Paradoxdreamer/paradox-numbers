import type { TelecomProvider } from "./provider.interface";
import { MockProvider } from "./providers/mock.provider";
import { TelnyxProvider } from "./providers/telnyx.provider";
import { TwilioProvider } from "./providers/twilio.provider";

export type ProviderName = "mock" | "telnyx" | "twilio";

const providers: Record<ProviderName, () => TelecomProvider> = {
  mock: () => new MockProvider(),
  telnyx: () => new TelnyxProvider(),
  twilio: () => new TwilioProvider(),
};

/**
 * Resolve the active telecom provider.
 * Order of preference:
 *   1. Explicit name argument
 *   2. TELECOM_PROVIDER env (mock | telnyx | twilio)
 *   3. mock
 */
export function getProvider(name?: ProviderName): TelecomProvider {
  const fromEnv = (process.env.TELECOM_PROVIDER ?? "mock").toLowerCase();
  const resolved = (name ?? fromEnv) as ProviderName;

  const factory = providers[resolved];
  if (!factory) {
    throw new Error(`Unknown provider: ${resolved}`);
  }
  return factory();
}

export type {
  TelecomProvider,
  AvailableNumber,
  ProvisionResult,
  IncomingMessage,
  WebhookVerifier,
} from "./provider.interface";
export { MockProvider } from "./providers/mock.provider";
export { TelnyxProvider, TelnyxWebhookVerifier } from "./providers/telnyx.provider";
export { TwilioProvider, TwilioWebhookVerifier } from "./providers/twilio.provider";

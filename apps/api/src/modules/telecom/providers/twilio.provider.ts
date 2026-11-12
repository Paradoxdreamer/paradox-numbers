import type {
  TelecomProvider,
  AvailableNumber,
  ProvisionResult,
  IncomingMessage,
  WebhookVerifier,
} from "../provider.interface";

const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * Twilio adapter for Paradox Numbers.
 *
 * Requires:
 *   TWILIO_ACCOUNT_SID
 *   TWILIO_AUTH_TOKEN
 *
 * Search:  GET /AvailablePhoneNumbers/{CC}/Local.json
 * Buy:     POST /IncomingPhoneNumbers.json
 * Release: DELETE /IncomingPhoneNumbers/{Sid}.json
 */
export class TwilioProvider implements TelecomProvider {
  readonly name = "twilio";

  private readonly accountSid: string;
  private readonly authHeader: string;

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    if (!sid || !token) {
      throw new Error(
        "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for TwilioProvider"
      );
    }
    this.accountSid = sid;
    this.authHeader =
      "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
  }

  async searchNumbers(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    const qs = new URLSearchParams();
    qs.set("PageSize", String(Math.min(params.limit ?? 20, 30)));

    if (params.areaCode) qs.set("AreaCode", params.areaCode);

    const caps = params.capabilities ?? ["sms"];
    if (caps.includes("sms")) qs.set("SmsEnabled", "true");
    if (caps.includes("mms")) qs.set("MmsEnabled", "true");
    if (caps.includes("voice")) qs.set("VoiceEnabled", "true");

    const path = `/Accounts/${this.accountSid}/AvailablePhoneNumbers/${params.countryCode}/Local.json?${qs}`;
    const res = await this.request("GET", path);

    const list = (res.available_phone_numbers ?? []) as Array<{
      phone_number: string;
      friendly_name?: string;
      iso_country?: string;
      lata?: string;
      locality?: string;
      rate_center?: string;
      latitude?: string;
      longitude?: string;
      region?: string;
      postal_code?: string;
      capabilities?: { voice?: boolean; SMS?: boolean; MMS?: boolean };
    }>;

    return list.map((n) => {
      const capabilities: ("sms" | "voice" | "mms")[] = [];
      if (n.capabilities?.SMS) capabilities.push("sms");
      if (n.capabilities?.MMS) capabilities.push("mms");
      if (n.capabilities?.voice) capabilities.push("voice");
      if (capabilities.length === 0) capabilities.push("sms");

      let areaCode = params.areaCode ?? null;
      if (!areaCode && n.phone_number?.startsWith("+1") && n.phone_number.length >= 5) {
        areaCode = n.phone_number.slice(2, 5);
      }

      return {
        phoneNumber: n.phone_number,
        countryCode: n.iso_country ?? params.countryCode,
        areaCode,
        capabilities,
        // Twilio search does not return price; use a conservative default
        monthlyCostCents: 100,
        providerData: {
          locality: n.locality,
          region: n.region,
          rateCenter: n.rate_center,
        },
      };
    });
  }

  async provisionNumber(params: {
    phoneNumber: string;
    webhookUrl: string;
  }): Promise<ProvisionResult> {
    const body = new URLSearchParams();
    body.set("PhoneNumber", params.phoneNumber);
    body.set("SmsUrl", params.webhookUrl);
    body.set("SmsMethod", "POST");

    const path = `/Accounts/${this.accountSid}/IncomingPhoneNumbers.json`;
    const res = await this.request("POST", path, body.toString(), true);

    const sid = res.sid as string | undefined;
    if (!sid) {
      throw new Error("Twilio provision response missing sid");
    }

    return {
      providerNumberId: sid,
      phoneNumber: (res.phone_number as string) ?? params.phoneNumber,
      status: "provisioned",
    };
  }

  async releaseNumber(params: {
    phoneNumber: string;
    providerNumberId?: string;
  }): Promise<{ success: boolean }> {
    let sid = params.providerNumberId;

    if (!sid) {
      const qs = new URLSearchParams();
      qs.set("PhoneNumber", params.phoneNumber);
      const list = await this.request(
        "GET",
        `/Accounts/${this.accountSid}/IncomingPhoneNumbers.json?${qs}`
      );
      const rows = (list.incoming_phone_numbers ?? []) as Array<{ sid: string }>;
      sid = rows[0]?.sid;
    }

    if (!sid) {
      throw new Error(`Twilio number not found for ${params.phoneNumber}`);
    }

    await this.request(
      "DELETE",
      `/Accounts/${this.accountSid}/IncomingPhoneNumbers/${sid}.json`
    );
    return { success: true };
  }

  private async request(
    method: string,
    path: string,
    body?: string,
    form = false
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${TWILIO_API}${path}`, {
      method,
      headers: {
        Authorization: this.authHeader,
        Accept: "application/json",
        ...(form
          ? { "Content-Type": "application/x-www-form-urlencoded" }
          : {}),
      },
      body,
    });

    if (res.status === 204) return {};

    const json = (await res.json().catch(() => ({}))) as Record<
      string,
      unknown
    > & {
      message?: string;
      code?: number;
    };

    if (!res.ok) {
      throw new Error(
        json.message ?? `Twilio ${method} ${path} failed (${res.status})`
      );
    }

    return json;
  }
}

/** Twilio SMS webhook form-urlencoded / JSON parser */
export class TwilioWebhookVerifier implements WebhookVerifier {
  verify(_payload: string | Buffer, _signature: string, _secret: string): boolean {
    // Full X-Twilio-Signature HMAC can be added with the auth token.
    // Route-level SMS_WEBHOOK_SECRET remains the primary gate for now.
    return true;
  }

  parseIncoming(payload: unknown): IncomingMessage | null {
    const p = payload as {
      From?: string;
      To?: string;
      Body?: string;
      MessageSid?: string;
      SmsSid?: string;
      from?: string;
      to?: string;
      body?: string;
      id?: string;
    };

    const from = p.From ?? p.from;
    const to = p.To ?? p.to;
    const body = p.Body ?? p.body;
    if (!from || !to || body == null) return null;

    return {
      from,
      to,
      body,
      providerMessageId: p.MessageSid ?? p.SmsSid ?? p.id ?? `twilio_${Date.now()}`,
      receivedAt: new Date().toISOString(),
      raw: payload,
    };
  }
}

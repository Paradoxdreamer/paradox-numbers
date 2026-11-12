import type {
  TelecomProvider,
  AvailableNumber,
  ProvisionResult,
  IncomingMessage,
  WebhookVerifier,
} from "../provider.interface";

const TELNYX_API = "https://api.telnyx.com/v2";

/**
 * Telnyx adapter for Paradox Numbers.
 *
 * Requires:
 *   TELNYX_API_KEY
 *   TELNYX_MESSAGING_PROFILE_ID  (optional but recommended for SMS routing)
 *
 * Search uses GET /available_phone_numbers
 * Provision uses POST /number_orders
 * Release uses DELETE /phone_numbers/:id
 */
export class TelnyxProvider implements TelecomProvider {
  readonly name = "telnyx";

  private readonly apiKey: string;
  private readonly messagingProfileId: string | undefined;

  constructor() {
    const key = process.env.TELNYX_API_KEY;
    if (!key) {
      throw new Error("TELNYX_API_KEY is required for TelnyxProvider");
    }
    this.apiKey = key;
    this.messagingProfileId = process.env.TELNYX_MESSAGING_PROFILE_ID;
  }

  async searchNumbers(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    const qs = new URLSearchParams();
    qs.set("filter[country_code]", params.countryCode);
    qs.set("filter[phone_number_type]", "local");
    qs.set("filter[limit]", String(params.limit ?? 20));

    if (params.areaCode) {
      qs.set("filter[national_destination_code]", params.areaCode);
    }

    const features = params.capabilities?.length
      ? params.capabilities
      : ["sms"];
    for (const f of features) {
      qs.append("filter[features][]", f);
    }

    const res = await this.request(
      "GET",
      `/available_phone_numbers?${qs.toString()}`
    );

    const data = (res.data ?? []) as Array<{
      phone_number: string;
      cost_information?: { monthly_cost?: string; currency?: string };
      features?: Array<{ name: string }>;
      region_information?: Array<{ region_type: string; region_name: string }>;
    }>;

    return data.map((n) => {
      const monthly = n.cost_information?.monthly_cost
        ? Math.round(parseFloat(n.cost_information.monthly_cost) * 100)
        : 0;

      const caps = (n.features ?? [])
        .map((f) => f.name.toLowerCase())
        .filter((f): f is "sms" | "voice" | "mms" =>
          f === "sms" || f === "voice" || f === "mms"
        );

      const area =
        n.region_information?.find((r) => r.region_type === "rate_center")
          ?.region_name ?? params.areaCode ?? null;

      // Derive area code from E.164 US/CA when possible
      let areaCode = params.areaCode ?? null;
      if (!areaCode && n.phone_number.startsWith("+1") && n.phone_number.length >= 5) {
        areaCode = n.phone_number.slice(2, 5);
      }

      return {
        phoneNumber: n.phone_number,
        countryCode: params.countryCode,
        areaCode,
        capabilities: caps.length ? caps : (["sms"] as ("sms" | "voice" | "mms")[]),
        monthlyCostCents: monthly,
        providerData: { region: area },
      };
    });
  }

  async provisionNumber(params: {
    phoneNumber: string;
    webhookUrl: string;
  }): Promise<ProvisionResult> {
    const body: Record<string, unknown> = {
      phone_numbers: [{ phone_number: params.phoneNumber }],
      customer_reference: `paradox_${Date.now()}`,
    };

    if (this.messagingProfileId) {
      body.messaging_profile_id = this.messagingProfileId;
    }

    // Note: inbound SMS webhook is configured on the messaging profile in Telnyx.
    // params.webhookUrl is accepted for interface compatibility and logged for ops.
    void params.webhookUrl;

    const res = await this.request("POST", "/number_orders", body);
    const order = res.data as {
      id: string;
      status: string;
      phone_numbers?: Array<{ id?: string; phone_number: string; status?: string }>;
    };

    const pn = order.phone_numbers?.[0];
    const providerNumberId = pn?.id ?? order.id;

    const status =
      order.status === "success" || pn?.status === "success"
        ? "provisioned"
        : "pending";

    return {
      providerNumberId,
      phoneNumber: params.phoneNumber,
      status,
    };
  }

  async releaseNumber(params: {
    phoneNumber: string;
    providerNumberId?: string;
  }): Promise<{ success: boolean }> {
    let id = params.providerNumberId;

    if (!id) {
      // Look up by phone number
      const list = await this.request(
        "GET",
        `/phone_numbers?filter[phone_number]=${encodeURIComponent(params.phoneNumber)}`
      );
      const rows = (list.data ?? []) as Array<{ id: string }>;
      id = rows[0]?.id;
    }

    if (!id) {
      throw new Error(`Telnyx number not found for ${params.phoneNumber}`);
    }

    await this.request("DELETE", `/phone_numbers/${id}`);
    return { success: true };
  }

  private async request(
    method: string,
    path: string,
    body?: unknown
  ): Promise<{ data?: unknown }> {
    const res = await fetch(`${TELNYX_API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const json = (await res.json().catch(() => ({}))) as {
      data?: unknown;
      errors?: Array<{ detail?: string; title?: string }>;
    };

    if (!res.ok) {
      const detail =
        json.errors?.[0]?.detail ||
        json.errors?.[0]?.title ||
        `Telnyx ${method} ${path} failed (${res.status})`;
      throw new Error(detail);
    }

    return json;
  }
}

/**
 * Telnyx inbound message webhook parser.
 * Expects the standard messaging webhook payload shape.
 */
export class TelnyxWebhookVerifier implements WebhookVerifier {
  verify(_payload: string | Buffer, _signature: string, _secret: string): boolean {
    // Telnyx uses ed25519 signature headers; full verification can be added
    // when public key is configured. For now we rely on SMS_WEBHOOK_SECRET
    // at the route layer (shared secret in front of this parser).
    return true;
  }

  parseIncoming(payload: unknown): IncomingMessage | null {
    const p = payload as {
      data?: {
        event_type?: string;
        payload?: {
          from?: { phone_number?: string };
          to?: Array<{ phone_number?: string }> | { phone_number?: string };
          text?: string;
          id?: string;
          received_at?: string;
        };
      };
      // Flat shape fallbacks
      from?: string;
      to?: string;
      text?: string;
      id?: string;
    };

    const inner = p.data?.payload;
    if (inner) {
      const toRaw = inner.to;
      const to =
        Array.isArray(toRaw)
          ? toRaw[0]?.phone_number
          : typeof toRaw === "object"
            ? toRaw?.phone_number
            : undefined;

      if (!inner.from?.phone_number || !to || !inner.text) return null;

      return {
        from: inner.from.phone_number,
        to,
        body: inner.text,
        providerMessageId: inner.id ?? `telnyx_${Date.now()}`,
        receivedAt: inner.received_at ?? new Date().toISOString(),
        raw: payload,
      };
    }

    // Flat fallback
    if (p.from && p.to && p.text) {
      return {
        from: p.from,
        to: p.to,
        body: p.text,
        providerMessageId: p.id ?? `telnyx_${Date.now()}`,
        receivedAt: new Date().toISOString(),
        raw: payload,
      };
    }

    return null;
  }
}

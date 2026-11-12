import { supabase } from "./supabase";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  auth = false
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined),
  };

  if (auth) {
    const token = await getAccessToken();
    if (!token) {
      throw new Error("Not authenticated");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed (${res.status})`);
  }

  return data as T;
}

export type AvailableNumber = {
  phoneNumber: string;
  countryCode: string;
  areaCode: string | null;
  capabilities: ("sms" | "voice" | "mms")[];
  monthlyCostCents: number;
};

export type Account = {
  id: string;
  name: string;
  type: "personal" | "business";
  created_at: string;
};

export type Rental = {
  id: string;
  account_id: string;
  number_id: string;
  status: string;
  started_at: string;
  current_period_end: string;
  phone_number?: string | null;
  monthly_cost_cents?: number | null;
};

export type Message = {
  id: string;
  rental_id: string;
  from_number: string;
  body: string;
  received_at: string;
  analysis?: {
    service: string;
    code: string | null;
  };
};

export const api = {
  resolveAccount(name?: string) {
    return request<{ account: Account }>(
      "/accounts/me",
      {
        method: "POST",
        body: JSON.stringify({ name }),
      },
      true
    );
  },

  searchNumbers(params: {
    country?: string;
    areaCode?: string;
    capabilities?: string;
    limit?: number;
  }) {
    const q = new URLSearchParams();
    if (params.country) q.set("country", params.country);
    if (params.areaCode) q.set("areaCode", params.areaCode);
    if (params.capabilities) q.set("capabilities", params.capabilities);
    if (params.limit) q.set("limit", String(params.limit));

    return request<{ numbers: AvailableNumber[] }>(
      `/numbers/search?${q.toString()}`,
      {},
      true
    );
  },

  createRental(input: { phoneNumber: string; webhookUrl?: string }) {
    return request<{ rental: Rental }>(
      "/rentals",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
      true
    );
  },

  listRentals(accountId: string) {
    return request<{ rentals: Rental[] }>(
      `/accounts/${accountId}/rentals`,
      {},
      true
    );
  },

  cancelRental(rentalId: string) {
    return request<{ rental: Rental }>(
      `/rentals/${rentalId}/cancel`,
      { method: "POST" },
      true
    );
  },

  initiatePayment(rentalId: string) {
    return request<{
      payment: { reference: string; amountCents: number; checkoutUrl: string };
    }>(`/billing/initiate/${rentalId}`, { method: "POST" }, true);
  },

  listMessages(rentalId: string) {
    return request<{ messages: Message[] }>(
      `/rentals/${rentalId}/messages`,
      {},
      true
    );
  },
};

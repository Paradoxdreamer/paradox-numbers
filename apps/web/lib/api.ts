const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api/v1";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
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
};

export const api = {
  createAccount(name: string, type: "personal" | "business" = "personal") {
    return request<{ account: Account }>("/accounts", {
      method: "POST",
      body: JSON.stringify({ name, type }),
    });
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
      `/numbers/search?${q.toString()}`
    );
  },

  createRental(input: {
    accountId: string;
    phoneNumber: string;
    webhookUrl?: string;
  }) {
    return request<{ rental: Rental; provision: { providerNumberId: string } }>(
      "/rentals",
      {
        method: "POST",
        body: JSON.stringify(input),
      }
    );
  },

  listRentals(accountId: string) {
    return request<{ rentals: Rental[] }>(`/accounts/${accountId}/rentals`);
  },
};

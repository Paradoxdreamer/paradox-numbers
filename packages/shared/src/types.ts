// Shared domain types for Paradox Numbers

export type AccountType = "personal" | "business";
export type AccountRole = "owner" | "admin" | "member";
export type NumberStatus = "available" | "reserved" | "assigned" | "released";
export type RentalStatus =
  | "pending_payment"
  | "provisioning"
  | "active"
  | "past_due"
  | "suspended"
  | "released"
  | "cancelled"
  | "expired";
export type NumberCapability = "sms" | "voice" | "mms";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  created_at: string;
  updated_at: string;
}

export interface AccountUser {
  id: string;
  account_id: string;
  user_id: string;
  role: AccountRole;
  created_at: string;
}

export interface Provider {
  id: string;
  name: string;
  is_active: boolean;
  created_at: string;
}

export interface Number {
  id: string;
  provider_id: string;
  phone_number: string;
  country_code: string;
  area_code: string | null;
  capabilities: NumberCapability[];
  monthly_cost_cents: number;
  status: NumberStatus;
  created_at: string;
  updated_at: string;
}

export interface Rental {
  id: string;
  account_id: string;
  number_id: string;
  status: RentalStatus;
  started_at: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/** Rental with joined number fields for list/detail views */
export interface RentalWithNumber extends Rental {
  phone_number: string | null;
  monthly_cost_cents: number | null;
}

export interface Message {
  id: string;
  rental_id: string;
  number_id: string;
  from_number: string;
  body: string;
  received_at: string;
  provider_message_id: string | null;
  raw_payload: unknown | null;
  created_at: string;
}

// Insert types (omit generated fields)
export type AccountInsert = Omit<Account, "id" | "created_at" | "updated_at">;
export type NumberInsert = Omit<Number, "id" | "created_at" | "updated_at">;
export type RentalInsert = Omit<Rental, "id" | "created_at" | "updated_at">;
export type MessageInsert = Omit<Message, "id" | "created_at">;

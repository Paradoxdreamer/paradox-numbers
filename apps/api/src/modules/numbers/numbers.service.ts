import type { AvailableNumber, TelecomProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import type { Number as DbNumber } from "@paradox/shared";

export class NumbersService {
  constructor(private provider: TelecomProvider) {}

  async search(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    const results = await this.provider.searchNumbers(params);

    try {
      await this.syncNewToInventory(results);
    } catch (err) {
      console.error("[NumbersService] inventory sync failed", err);
    }

    return results;
  }

  async findByPhoneNumber(phoneNumber: string): Promise<DbNumber | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("numbers")
      .select("*")
      .eq("phone_number", phoneNumber)
      .maybeSingle();

    if (error) throw error;
    return data as DbNumber | null;
  }

  async claim(numberId: string): Promise<boolean> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("numbers")
      .update({ status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", numberId)
      .in("status", ["available", "reserved"])
      .select("id")
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async releaseClaim(numberId: string): Promise<void> {
    const supabase = getSupabase();
    await supabase
      .from("numbers")
      .update({ status: "available", updated_at: new Date().toISOString() })
      .eq("id", numberId)
      .eq("status", "assigned");
  }

  private async syncNewToInventory(numbers: AvailableNumber[]): Promise<void> {
    if (numbers.length === 0) return;

    const supabase = getSupabase();

    const providerName = this.provider.name;
    let { data: provider } = await supabase
      .from("providers")
      .select("id")
      .eq("name", providerName)
      .maybeSingle();

    if (!provider) {
      const { data: created, error: createErr } = await supabase
        .from("providers")
        .insert({ name: providerName, is_active: true })
        .select("id")
        .single();

      if (createErr) throw createErr;
      provider = created;
    }

    const phoneNumbers = numbers.map((n) => n.phoneNumber);

    const { data: existing } = await supabase
      .from("numbers")
      .select("phone_number")
      .in("phone_number", phoneNumbers);

    const existingSet = new Set((existing ?? []).map((r) => r.phone_number));

    const toInsert = numbers
      .filter((n) => !existingSet.has(n.phoneNumber))
      .map((n) => ({
        provider_id: provider!.id,
        phone_number: n.phoneNumber,
        country_code: n.countryCode,
        area_code: n.areaCode,
        capabilities: n.capabilities,
        monthly_cost_cents: n.monthlyCostCents,
        status: "available" as const,
      }));

    if (toInsert.length === 0) return;

    const { error } = await supabase.from("numbers").insert(toInsert);
    if (error) throw error;
  }
}

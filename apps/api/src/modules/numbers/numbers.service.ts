import type { AvailableNumber, TelecomProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import type { Number as DbNumber } from "@paradox/shared";

export class NumbersService {
  constructor(private provider: TelecomProvider) {}

  /**
   * Search available numbers.
   * 1. Ask the telecom provider for live inventory.
   * 2. Optionally sync new numbers into our `numbers` table (status = available).
   * 3. Return the provider results (caller can decide whether to show only DB-cached ones later).
   */
  async search(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    const results = await this.provider.searchNumbers(params);

    // Best-effort: upsert into our inventory so we have a source of truth.
    // Failures here should not break the search response.
    try {
      await this.syncToInventory(results);
    } catch (err) {
      console.error("[NumbersService] inventory sync failed", err);
    }

    return results;
  }

  /**
   * Look up a number we already know about in the database.
   */
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

  /**
   * Mark a number as assigned (after successful provision).
   */
  async markAssigned(numberId: string): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase
      .from("numbers")
      .update({ status: "assigned", updated_at: new Date().toISOString() })
      .eq("id", numberId);

    if (error) throw error;
  }

  private async syncToInventory(numbers: AvailableNumber[]): Promise<void> {
    if (numbers.length === 0) return;

    const supabase = getSupabase();

    // Resolve the provider row (create mock if missing).
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

    const rows = numbers.map((n) => ({
      provider_id: provider!.id,
      phone_number: n.phoneNumber,
      country_code: n.countryCode,
      area_code: n.areaCode,
      capabilities: n.capabilities,
      monthly_cost_cents: n.monthlyCostCents,
      status: "available" as const,
    }));

    // Upsert on phone_number — keep existing status if already assigned/reserved.
    const { error } = await supabase.from("numbers").upsert(rows, {
      onConflict: "phone_number",
      ignoreDuplicates: false,
    });

    if (error) throw error;
  }
}

import type { AvailableNumber, TelecomProvider } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import type { Number as DbNumber } from "@paradox/shared";

export class NumbersService {
  constructor(private provider: TelecomProvider) {}

  /**
   * Search available numbers.
   * 1. Ask the telecom provider for live inventory.
   * 2. Best-effort sync of *new* numbers into our `numbers` table.
   * 3. Return the provider results.
   */
  async search(params: {
    countryCode: string;
    areaCode?: string;
    capabilities?: ("sms" | "voice" | "mms")[];
    limit?: number;
  }): Promise<AvailableNumber[]> {
    const results = await this.provider.searchNumbers(params);

    // Best-effort: only insert numbers we have never seen before.
    // Never overwrite an existing status (assigned / reserved / etc.).
    try {
      await this.syncNewToInventory(results);
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

  private async syncNewToInventory(numbers: AvailableNumber[]): Promise<void> {
    if (numbers.length === 0) return;

    const supabase = getSupabase();

    // Resolve the provider row (create if missing).
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

    // Which of these already exist?
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

import type { TelecomProvider, ProvisionResult } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { NumbersService } from "../numbers/numbers.service";
import type { Rental } from "@paradox/shared";

export interface CreateRentalInput {
  accountId: string;
  phoneNumber: string;
  webhookUrl: string;
  /** Billing period length in days. Default 30. */
  periodDays?: number;
}

export interface CreateRentalResult {
  rental: Rental;
  provision: ProvisionResult;
}

export class RentalsService {
  private numbersService: NumbersService;

  constructor(private provider: TelecomProvider) {
    this.numbersService = new NumbersService(provider);
  }

  /**
   * Create a rental end-to-end:
   * 1. Ensure the number exists in our inventory (or sync it).
   * 2. Call the telecom provider to provision the number.
   * 3. Insert a rental row and mark the number as assigned.
   */
  async create(input: CreateRentalInput): Promise<CreateRentalResult> {
    const supabase = getSupabase();
    const periodDays = input.periodDays ?? 30;

    // 1. Locate or create the number row
    let number = await this.numbersService.findByPhoneNumber(input.phoneNumber);

    if (!number) {
      // Provider may have it available — force a search so it lands in inventory
      await this.numbersService.search({
        countryCode: "US", // will be refined later when we parse E.164
        limit: 50,
      });
      number = await this.numbersService.findByPhoneNumber(input.phoneNumber);
    }

    if (!number) {
      throw new Error(`Number ${input.phoneNumber} is not available in inventory`);
    }

    if (number.status !== "available" && number.status !== "reserved") {
      throw new Error(
        `Number ${input.phoneNumber} is not available (status: ${number.status})`
      );
    }

    // 2. Provision with the real (or mock) provider
    const provision = await this.provider.provisionNumber({
      phoneNumber: input.phoneNumber,
      webhookUrl: input.webhookUrl,
    });

    // 3. Persist the rental
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setDate(periodEnd.getDate() + periodDays);

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .insert({
        account_id: input.accountId,
        number_id: number.id,
        status: "active",
        started_at: now.toISOString(),
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        cancel_at_period_end: false,
      })
      .select("*")
      .single();

    if (rentalError) {
      // Best-effort: try to release the number at the provider if DB insert failed
      try {
        await this.provider.releaseNumber({
          phoneNumber: input.phoneNumber,
          providerNumberId: provision.providerNumberId,
        });
      } catch {
        // log and continue — the DB error is the primary failure
      }
      throw rentalError;
    }

    // 4. Mark number as assigned
    await this.numbersService.markAssigned(number.id);

    return {
      rental: rental as Rental,
      provision,
    };
  }

  /**
   * List rentals for an account.
   */
  async listByAccount(accountId: string): Promise<Rental[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("rentals")
      .select("*")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data ?? []) as Rental[];
  }

  /**
   * Get a single rental by id.
   */
  async getById(rentalId: string): Promise<Rental | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("rentals")
      .select("*")
      .eq("id", rentalId)
      .maybeSingle();

    if (error) throw error;
    return data as Rental | null;
  }
}

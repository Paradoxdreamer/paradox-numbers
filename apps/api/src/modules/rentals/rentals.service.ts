import type { TelecomProvider, ProvisionResult } from "../telecom";
import { getSupabase } from "../../lib/supabase";
import { NumbersService } from "../numbers/numbers.service";
import type { Rental } from "@paradox/shared";

export interface CreateRentalInput {
  accountId: string;
  phoneNumber: string;
  webhookUrl: string;
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

  async create(input: CreateRentalInput): Promise<CreateRentalResult> {
    const supabase = getSupabase();
    const periodDays = input.periodDays ?? 30;

    let number = await this.numbersService.findByPhoneNumber(input.phoneNumber);

    if (!number) {
      await this.numbersService.search({
        countryCode: "US",
        limit: 50,
      });
      number = await this.numbersService.findByPhoneNumber(input.phoneNumber);
    }

    if (!number) {
      throw new Error(`Number ${input.phoneNumber} is not available in inventory`);
    }

    const claimed = await this.numbersService.claim(number.id);
    if (!claimed) {
      throw new Error(`Number ${input.phoneNumber} was just taken`);
    }

    let provision: ProvisionResult;
    try {
      provision = await this.provider.provisionNumber({
        phoneNumber: input.phoneNumber,
        webhookUrl: input.webhookUrl,
      });
    } catch (err) {
      await this.numbersService.releaseClaim(number.id);
      throw err;
    }

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
      try {
        await this.provider.releaseNumber({
          phoneNumber: input.phoneNumber,
          providerNumberId: provision.providerNumberId,
        });
      } catch {
        // best effort
      }
      await this.numbersService.releaseClaim(number.id);
      throw rentalError;
    }

    return {
      rental: rental as Rental,
      provision,
    };
  }

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

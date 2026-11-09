import { getSupabase } from "../../lib/supabase";
import type { Account, AccountType } from "@paradox/shared";

export interface CreateAccountInput {
  name: string;
  type?: AccountType;
  /** Optional: link a Supabase Auth user immediately */
  userId?: string;
}

export class AccountsService {
  async create(input: CreateAccountInput): Promise<Account> {
    const supabase = getSupabase();

    const { data: account, error } = await supabase
      .from("accounts")
      .insert({
        name: input.name.trim(),
        type: input.type ?? "personal",
      })
      .select("*")
      .single();

    if (error) throw error;

    // Optionally attach the creator as owner
    if (input.userId) {
      const { error: linkError } = await supabase.from("account_users").insert({
        account_id: account.id,
        user_id: input.userId,
        role: "owner",
      });

      if (linkError) {
        // Non-fatal for now — account still exists
        console.error("[AccountsService] failed to link user", linkError);
      }
    }

    return account as Account;
  }

  async getById(accountId: string): Promise<Account | null> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();

    if (error) throw error;
    return data as Account | null;
  }
}

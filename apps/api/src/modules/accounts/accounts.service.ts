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

    if (input.userId) {
      await this.linkUser(account.id, input.userId, "owner");
    }

    return account as Account;
  }

  /**
   * Get the primary account for a user, or create a personal one if none exists.
   * This is the main entry point after Auth.
   */
  async getOrCreateForUser(
    userId: string,
    fallbackName = "Personal"
  ): Promise<Account> {
    const supabase = getSupabase();

    const { data: link, error: linkError } = await supabase
      .from("account_users")
      .select("account_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (linkError) throw linkError;

    if (link) {
      const account = await this.getById(link.account_id);
      if (account) return account;
    }

    return this.create({
      name: fallbackName,
      type: "personal",
      userId,
    });
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

  /**
   * Returns true if the user is a member (any role) of the account.
   */
  async userBelongsToAccount(
    userId: string,
    accountId: string
  ): Promise<boolean> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("account_users")
      .select("id")
      .eq("user_id", userId)
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw error;
    return !!data;
  }

  async linkUser(
    accountId: string,
    userId: string,
    role: "owner" | "admin" | "member" = "member"
  ): Promise<void> {
    const supabase = getSupabase();
    const { error } = await supabase.from("account_users").upsert(
      {
        account_id: accountId,
        user_id: userId,
        role,
      },
      { onConflict: "account_id,user_id" }
    );

    if (error) throw error;
  }
}

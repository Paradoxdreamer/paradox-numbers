import { getSupabase } from "../../lib/supabase";
import type { IncomingMessage } from "../telecom";
import type { Message } from "@paradox/shared";
import { analyzeSms, type SmsAnalysis } from "./sms-analyzer";

export type EnrichedMessage = Message & {
  analysis: SmsAnalysis;
};

export class MessagesService {
  /**
   * Persist an incoming message linked to the correct rental + number.
   * Attaches service + OTP analysis.
   */
  async storeIncoming(msg: IncomingMessage): Promise<EnrichedMessage> {
    const supabase = getSupabase();

    const { data: number, error: numberError } = await supabase
      .from("numbers")
      .select("id")
      .eq("phone_number", msg.to)
      .maybeSingle();

    if (numberError) throw numberError;
    if (!number) {
      throw new Error(`No inventory entry for destination number ${msg.to}`);
    }

    const { data: rental, error: rentalError } = await supabase
      .from("rentals")
      .select("id")
      .eq("number_id", number.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (rentalError) throw rentalError;
    if (!rental) {
      throw new Error(`No active rental found for number ${msg.to}`);
    }

    const analysis = analyzeSms(msg.body);

    const { data: message, error: insertError } = await supabase
      .from("messages")
      .insert({
        rental_id: rental.id,
        number_id: number.id,
        from_number: msg.from,
        body: msg.body,
        received_at: msg.receivedAt,
        provider_message_id: msg.providerMessageId,
        raw_payload: {
          ...(typeof msg.raw === "object" && msg.raw !== null ? msg.raw : {}),
          analysis,
        },
      })
      .select("*")
      .single();

    if (insertError) throw insertError;

    return {
      ...(message as Message),
      analysis,
    };
  }

  /**
   * List messages for a rental (newest first), with analysis attached.
   */
  async listByRental(rentalId: string, limit = 50): Promise<EnrichedMessage[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("rental_id", rentalId)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data ?? []).map((msg) => {
      const raw = msg.raw_payload as { analysis?: SmsAnalysis } | null;
      const analysis = raw?.analysis ?? analyzeSms(msg.body);
      return { ...(msg as Message), analysis };
    });
  }
}
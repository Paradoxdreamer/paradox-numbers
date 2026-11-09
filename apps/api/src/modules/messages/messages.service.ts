import { getSupabase } from "../../lib/supabase";
import type { IncomingMessage } from "../telecom";
import type { Message } from "@paradox/shared";

export class MessagesService {
  /**
   * Persist an incoming message linked to the correct rental + number.
   * Looks up the number by the `to` address and finds an active rental.
   */
  async storeIncoming(msg: IncomingMessage): Promise<Message> {
    const supabase = getSupabase();

    // Find the number we provisioned
    const { data: number, error: numberError } = await supabase
      .from("numbers")
      .select("id")
      .eq("phone_number", msg.to)
      .maybeSingle();

    if (numberError) throw numberError;
    if (!number) {
      throw new Error(`No inventory entry for destination number ${msg.to}`);
    }

    // Find an active rental for this number
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

    const { data: message, error: insertError } = await supabase
      .from("messages")
      .insert({
        rental_id: rental.id,
        number_id: number.id,
        from_number: msg.from,
        body: msg.body,
        received_at: msg.receivedAt,
        provider_message_id: msg.providerMessageId,
        raw_payload: msg.raw,
      })
      .select("*")
      .single();

    if (insertError) throw insertError;
    return message as Message;
  }

  /**
   * List messages for a rental (newest first).
   */
  async listByRental(rentalId: string, limit = 50): Promise<Message[]> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("rental_id", rentalId)
      .order("received_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []) as Message[];
  }
}

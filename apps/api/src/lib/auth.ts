import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";

let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient {
  if (authClient) return authClient;

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key not configured on API");
  }

  authClient = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return authClient;
}

export async function requireUserId(request: FastifyRequest): Promise<string> {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AuthError("Empty bearer token");
  }

  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError("Invalid or expired token");
  }

  return data.user.id;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

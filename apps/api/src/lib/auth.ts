import { createClient } from "@supabase/supabase-js";
import type { FastifyRequest } from "fastify";

/**
 * Verifies a Supabase JWT and returns the authenticated user id.
 * Throws if the token is missing or invalid.
 */
export async function requireUserId(request: FastifyRequest): Promise<string> {
  const header = request.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    throw new AuthError("Missing or invalid Authorization header");
  }

  const token = header.slice(7).trim();
  if (!token) {
    throw new AuthError("Empty bearer token");
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase URL or anon key not configured on API");
  }

  // Use the anon key client only to validate the JWT.
  // We never use this client for privileged DB operations.
  const supabase = createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

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

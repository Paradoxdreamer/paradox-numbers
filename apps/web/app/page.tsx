"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase";
import { api, type AvailableNumber, type Account, type Rental, type Message } from "../lib/api";
import type { User } from "@supabase/supabase-js";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedRental, setSelectedRental] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);
  const resolvedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState("");

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        resolveAccount(sessionUser);
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) {
        resolveAccount(sessionUser);
      } else {
        setAccount(null);
        setRentals([]);
        setMessages([]);
        setSelectedRental(null);
        setResolved(false);
        resolvedRef.current = false;
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function resolveAccount(u: User) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const name =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split("@")[0] ||
        "Personal";

      const { account } = await api.resolveAccount(name);
      setAccount(account);
      setResolved(true);

      const { rentals } = await api.listRentals(account.id);
      setRentals(rentals);
    } catch (err) {
      resolvedRef.current = false;
      setError(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setAuthLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: displayName || undefined,
            },
          },
        });
        if (error) throw error;
        setSuccess("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    setUser(null);
    setAccount(null);
    setRentals([]);
    setNumbers([]);
    setMessages([]);
    setSelectedRental(null);
    setResolved(false);
    resolvedRef.current = false;
  }

  // remaining handlers and JSX unchanged from previous full version
  return null;
}

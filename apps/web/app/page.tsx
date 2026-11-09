"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { api, type AvailableNumber, type Account, type Rental } from "../lib/api";
import type { User } from "@supabase/supabase-js";

export default function HomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState("");

  // Auth form state
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Bootstrap session
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
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function resolveAccount(u: User) {
    setLoading(true);
    setError(null);
    try {
      const name =
        u.user_metadata?.full_name ||
        u.user_metadata?.name ||
        u.email?.split("@")[0] ||
        "Personal";

      // userId is no longer sent — the API extracts it from the JWT
      const { account } = await api.resolveAccount(name);
      setAccount(account);

      const { rentals } = await api.listRentals(account.id);
      setRentals(rentals);
    } catch (err) {
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
        // onAuthStateChange will handle the rest
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
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSearching(true);
    try {
      const { numbers } = await api.searchNumbers({
        country: "US",
        areaCode: areaCode || undefined,
        capabilities: "sms",
        limit: 20,
      });
      setNumbers(numbers);
      if (numbers.length === 0) {
        setError("No numbers found. Try a different area code or clear the filter.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleRent(phoneNumber: string) {
    if (!account) {
      setError("You need an account to rent numbers");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.createRental({
        accountId: account.id,
        phoneNumber,
      });
      setSuccess(`Rented ${phoneNumber} successfully.`);
      setNumbers((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
      const { rentals } = await api.listRentals(account.id);
      setRentals(rentals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rent number");
    } finally {
      setLoading(false);
    }
  }

  if (loading && !user) {
    return (
      <div style={styles.page}>
        <p style={styles.muted}>Loading…</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>Paradox Numbers</h1>
          <p style={styles.tagline}>Connecting Possibilities. Beyond Boundaries.</p>
        </div>
        {user && (
          <div style={styles.accountBadge}>
            <span style={{ opacity: 0.6 }}>{user.email}</span>
            <button style={styles.linkButton} onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
      </header>

      <main style={styles.main}>
        {!user ? (
          <section style={styles.card}>
            <h2 style={styles.h2}>{mode === "signin" ? "Sign in" : "Create account"}</h2>
            <p style={styles.muted}>
              {mode === "signin"
                ? "Sign in to manage your virtual numbers."
                : "Create an account to start renting numbers."}
            </p>

            <form onSubmit={handleAuth} style={styles.form}>
              {mode === "signup" && (
                <input
                  style={styles.input}
                  placeholder="Display name (optional)"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              )}
              <input
                style={styles.input}
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                style={styles.input}
                type="password"
                placeholder="Password (min 6 characters)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button style={styles.button} type="submit" disabled={authLoading}>
                {authLoading
                  ? "Please wait…"
                  : mode === "signin"
                    ? "Sign in"
                    : "Sign up"}
              </button>
            </form>

            <p style={{ ...styles.muted, marginTop: 16, marginBottom: 0 }}>
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button
                    style={styles.linkButton}
                    onClick={() => {
                      setMode("signup");
                      setError(null);
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    style={styles.linkButton}
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                    }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </p>
          </section>
        ) : (
          <>
            <section style={styles.card}>
              <h2 style={styles.h2}>Find a number</h2>
              <form onSubmit={handleSearch} style={styles.row}>
                <input
                  style={{ ...styles.input, flex: 1 }}
                  placeholder="Area code (optional, e.g. 212)"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value)}
                />
                <button style={styles.button} type="submit" disabled={searching}>
                  {searching ? "Searching…" : "Search US numbers"}
                </button>
              </form>

              {numbers.length > 0 && (
                <ul style={styles.list}>
                  {numbers.map((n) => (
                    <li key={n.phoneNumber} style={styles.listItem}>
                      <div>
                        <strong style={{ fontSize: 18 }}>{n.phoneNumber}</strong>
                        <div style={styles.muted}>
                          {n.capabilities.join(", ")} · ${
                            (n.monthlyCostCents / 100).toFixed(2)
                          }/mo
                        </div>
                      </div>
                      <button
                        style={styles.buttonSecondary}
                        onClick={() => handleRent(n.phoneNumber)}
                        disabled={loading}
                      >
                        Rent
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {rentals.length > 0 && (
              <section style={styles.card}>
                <h2 style={styles.h2}>Your numbers</h2>
                <ul style={styles.list}>
                  {rentals.map((r) => (
                    <li key={r.id} style={styles.listItem}>
                      <div>
                        <code>{r.id.slice(0, 8)}…</code>
                        <div style={styles.muted}>
                          {r.status} · ends{" "}
                          {new Date(r.current_period_end).toLocaleDateString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}
      </main>

      <footer style={styles.footer}>
        <span>Paradox Telecom Services · Early access</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    maxWidth: 720,
    margin: "0 auto",
    padding: "32px 20px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 40,
  },
  logo: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  tagline: {
    color: "var(--text-muted)",
    fontSize: 14,
    marginTop: 4,
  },
  accountBadge: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
    fontSize: 13,
  },
  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: 24,
  },
  h2: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
  },
  muted: {
    color: "var(--text-muted)",
    fontSize: 14,
    marginBottom: 16,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  row: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
  },
  input: {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 14px",
    color: "var(--text)",
    outline: "none",
  },
  button: {
    background: "var(--accent)",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
  },
  buttonSecondary: {
    background: "transparent",
    color: "var(--accent-hover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 14px",
    fontWeight: 500,
  },
  linkButton: {
    background: "none",
    border: "none",
    color: "var(--accent-hover)",
    padding: 0,
    fontSize: 13,
    cursor: "pointer",
  },
  list: {
    listStyle: "none",
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  listItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderTop: "1px solid var(--border)",
  },
  error: {
    background: "rgba(239, 68, 68, 0.12)",
    color: "#fca5a5",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
  },
  success: {
    background: "rgba(34, 197, 94, 0.12)",
    color: "#86efac",
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
  },
  footer: {
    marginTop: 48,
    paddingTop: 24,
    borderTop: "1px solid var(--border)",
    color: "var(--text-muted)",
    fontSize: 13,
    textAlign: "center",
  },
};

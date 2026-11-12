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
  const [showEnded, setShowEnded] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const sessionUser = data.session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) resolveAccount(sessionUser);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user ?? null;
      setUser(sessionUser);
      if (sessionUser) resolveAccount(sessionUser);
      else {
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

  async function handleGoogle() {
    setError(null);
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setAuthLoading(false);
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset`,
      });
      if (error) throw error;
      setSuccess("Password reset link sent. Check your email.");
      setMode("signin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send reset link");
    } finally {
      setAuthLoading(false);
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
          options: { data: { full_name: displayName || undefined } },
        });
        if (error) throw error;
        setSuccess("Check your email to confirm your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
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
      if (numbers.length === 0) setError("No numbers found. Try a different area code.");
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
      await api.createRental({ phoneNumber });
      setSuccess(`Rental created for ${phoneNumber}. Status: pending payment.`);
      setNumbers((prev) => prev.filter((n) => n.phoneNumber !== phoneNumber));
      const { rentals } = await api.listRentals(account.id);
      setRentals(rentals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to rent number");
    } finally {
      setLoading(false);
    }
  }

  async function handlePay(rentalId: string) {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const { payment } = await api.initiatePayment(rentalId);
      setSuccess(`Payment started. Reference: ${payment.reference}`);
      window.open(payment.checkoutUrl, "_blank");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start payment");
    } finally {
      setLoading(false);
    }
  }

  function requestCancel(rentalId: string) {
    setConfirmId(rentalId);
  }

  async function handleCancel(rentalId: string) {
    if (!account) return;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      await api.cancelRental(rentalId);
      setSuccess("Rental ended. Number released.");
      setConfirmId(null);
      if (selectedRental === rentalId) {
        setSelectedRental(null);
        setMessages([]);
      }
      const { rentals } = await api.listRentals(account.id);
      setRentals(rentals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel rental");
    } finally {
      setLoading(false);
    }
  }

  async function copyText(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setSuccess(`Copied ${value}`);
    } catch {
      setError("Could not copy");
    }
  }

  async function openInbox(rentalId: string) {
    setSelectedRental(rentalId);
    setMessages([]);
    setError(null);
    try {
      const { messages } = await api.listMessages(rentalId);
      setMessages(messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }

  const visibleRentals = rentals.filter((r) =>
    showEnded
      ? true
      : r.status === "pending_payment" || r.status === "active" || r.status === "provisioning"
  );

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
            <h2 style={styles.h2}>
              {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Reset password"}
            </h2>
            <p style={styles.muted}>
              {mode === "signin"
                ? "Sign in to manage your virtual numbers."
                : mode === "signup"
                  ? "Create an account to start renting numbers."
                  : "Enter your email and we’ll send a reset link."}
            </p>

            {mode !== "forgot" && (
              <>
                <button
                  style={{ ...styles.buttonSecondary, width: "100%", marginBottom: 16 }}
                  onClick={handleGoogle}
                  disabled={authLoading}
                  type="button"
                >
                  Continue with Google
                </button>
                <div style={styles.divider}>
                  <span>OR</span>
                </div>
              </>
            )}

            {mode === "forgot" ? (
              <form onSubmit={handleForgot} style={styles.form}>
                <input style={styles.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <button style={styles.button} type="submit" disabled={authLoading}>
                  {authLoading ? "Sending…" : "Send reset link"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleAuth} style={styles.form}>
                {mode === "signup" && (
                  <input style={styles.input} placeholder="Display name (optional)" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                )}
                <input style={styles.input} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                <input style={styles.input} type="password" placeholder="Password (min 6 characters)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                <button style={styles.button} type="submit" disabled={authLoading}>
                  {authLoading ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
                </button>
              </form>
            )}

            <p style={{ ...styles.muted, marginTop: 16, marginBottom: 0 }}>
              {mode === "signin" ? (
                <>
                  No account?{" "}
                  <button style={styles.linkButton} onClick={() => { setMode("signup"); setError(null); }}>Sign up</button>
                  {" · "}
                  <button style={styles.linkButton} onClick={() => { setMode("forgot"); setError(null); }}>Forgot password</button>
                </>
              ) : mode === "signup" ? (
                <>
                  Already have an account?{" "}
                  <button style={styles.linkButton} onClick={() => { setMode("signin"); setError(null); }}>Sign in</button>
                </>
              ) : (
                <button style={styles.linkButton} onClick={() => { setMode("signin"); setError(null); }}>Back to sign in</button>
              )}
            </p>
          </section>
        ) : (
          <>
            <section style={styles.card}>
              <h2 style={styles.h2}>Find a number</h2>
              <form onSubmit={handleSearch} style={styles.row}>
                <input style={{ ...styles.input, flex: 1 }} placeholder="Area code (optional, e.g. 212)" value={areaCode} onChange={(e) => setAreaCode(e.target.value)} />
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
                          {n.capabilities.join(", ")} · ${(n.monthlyCostCents / 100).toFixed(2)}/mo
                        </div>
                      </div>
                      <button style={styles.buttonSecondary} onClick={() => handleRent(n.phoneNumber)} disabled={loading}>
                        Rent
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {rentals.length > 0 && (
              <section style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ ...styles.h2, marginBottom: 0 }}>Your numbers</h2>
                  <label style={{ ...styles.muted, marginBottom: 0, display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={showEnded} onChange={(e) => setShowEnded(e.target.checked)} />
                    Show ended
                  </label>
                </div>
                {visibleRentals.length === 0 ? (
                  <p style={styles.muted}>No active rentals. Toggle “Show ended” to see history.</p>
                ) : (
                  <ul style={styles.list}>
                    {visibleRentals.map((r) => (
                      <li key={r.id} style={styles.listItem}>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <strong style={{ fontSize: 16 }}>
                              {r.phone_number ?? r.id.slice(0, 8) + "…"}
                            </strong>
                            {r.phone_number && (
                              <button type="button" style={styles.linkButton} onClick={() => copyText(r.phone_number!)}>
                                Copy
                              </button>
                            )}
                          </div>
                          <div style={styles.muted}>
                            {r.status}
                            {r.monthly_cost_cents != null ? ` · $${(r.monthly_cost_cents / 100).toFixed(2)}/mo` : ""}
                            {" · ends "}
                            {new Date(r.current_period_end).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          {(r.status === "active" || r.status === "provisioning") && (
                            <>
                              <button style={styles.buttonSecondary} onClick={() => openInbox(r.id)}>Inbox</button>
                              <button style={styles.buttonSecondary} onClick={() => requestCancel(r.id)} disabled={loading}>Release</button>
                            </>
                          )}
                          {r.status === "pending_payment" && (
                            <>
                              <button style={styles.button} onClick={() => handlePay(r.id)} disabled={loading}>Pay</button>
                              <button style={styles.buttonSecondary} onClick={() => requestCancel(r.id)} disabled={loading}>Cancel</button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {selectedRental && (
              <section style={styles.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <h2 style={{ ...styles.h2, marginBottom: 0 }}>
                    Inbox
                    {rentals.find((x) => x.id === selectedRental)?.phone_number
                      ? ` · ${rentals.find((x) => x.id === selectedRental)?.phone_number}`
                      : ""}
                  </h2>
                  <button type="button" style={styles.buttonSecondary} onClick={() => openInbox(selectedRental)}>
                    Refresh
                  </button>
                </div>
                {messages.length === 0 ? (
                  <p style={styles.muted}>No messages yet for this number.</p>
                ) : (
                  <ul style={styles.list}>
                    {messages.map((m) => (
                      <li key={m.id} style={styles.listItem}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                            <strong>{m.analysis?.service ?? "Unknown"}</strong>
                            {m.analysis?.code && (
                              <>
                                <code style={{ background: "var(--surface-2)", padding: "2px 8px", borderRadius: 4 }}>
                                  {m.analysis.code}
                                </code>
                                <button type="button" style={styles.linkButton} onClick={() => copyText(m.analysis!.code!)}>
                                  Copy code
                                </button>
                              </>
                            )}
                          </div>
                          <div style={styles.muted}>{m.from_number}</div>
                          <div style={{ marginTop: 4, fontSize: 14 }}>{m.body}</div>
                          <div style={{ ...styles.muted, marginTop: 4, fontSize: 12 }}>
                            {new Date(m.received_at).toLocaleString()}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}

        {error && (
          <div style={styles.error}>
            <span>{error}</span>
            <button type="button" style={styles.linkButton} onClick={() => setError(null)}>Dismiss</button>
          </div>
        )}
        {success && (
          <div style={styles.success}>
            <span>{success}</span>
            <button type="button" style={styles.linkButton} onClick={() => setSuccess(null)}>Dismiss</button>
          </div>
        )}

        {confirmId && (
          <div style={styles.modalBackdrop}>
            <div style={styles.modal}>
              <h3 style={{ marginBottom: 8, fontSize: 16 }}>Confirm</h3>
              <p style={styles.muted}>
                End this rental? Pending rentals free the number; active rentals are released at the provider.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" style={styles.buttonSecondary} onClick={() => setConfirmId(null)} disabled={loading}>
                  Keep
                </button>
                <button type="button" style={styles.button} onClick={() => handleCancel(confirmId)} disabled={loading}>
                  {loading ? "Working…" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={styles.footer}>
        <span>Paradox Telecom Services · Early access</span>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 720, margin: "0 auto", padding: "32px 20px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 40 },
  logo: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" },
  tagline: { color: "var(--text-muted)", fontSize: 14, marginTop: 4 },
  accountBadge: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, fontSize: 13 },
  main: { flex: 1, display: "flex", flexDirection: "column", gap: 24 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 24 },
  h2: { fontSize: 16, fontWeight: 600, marginBottom: 12 },
  muted: { color: "var(--text-muted)", fontSize: 14, marginBottom: 16 },
  form: { display: "flex", flexDirection: "column", gap: 12 },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  input: { background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", color: "var(--text)", outline: "none" },
  button: { background: "var(--accent)", color: "white", border: "none", borderRadius: 8, padding: "10px 18px", fontWeight: 600, cursor: "pointer" },
  buttonSecondary: { background: "transparent", color: "var(--accent-hover)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 14px", fontWeight: 500, cursor: "pointer" },
  linkButton: { background: "none", border: "none", color: "var(--accent-hover)", padding: 0, fontSize: 13, cursor: "pointer" },
  divider: { display: "flex", alignItems: "center", gap: 12, margin: "16px 0", color: "var(--text-muted)", fontSize: 12, letterSpacing: "0.05em" },
  list: { listStyle: "none", marginTop: 20, display: "flex", flexDirection: "column", gap: 10 },
  listItem: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderTop: "1px solid var(--border)" },
  error: { background: "rgba(239, 68, 68, 0.12)", color: "#fca5a5", padding: "12px 16px", borderRadius: 8, fontSize: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  success: { background: "rgba(34, 197, 94, 0.12)", color: "#86efac", padding: "12px 16px", borderRadius: 8, fontSize: 14, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  modal: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 24, maxWidth: 400, width: "100%" },
  footer: { marginTop: 48, paddingTop: 24, borderTop: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 13, textAlign: "center" },
};

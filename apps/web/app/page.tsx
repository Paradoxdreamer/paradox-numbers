"use client";

import { useEffect, useState } from "react";
import { api, type AvailableNumber, type Account, type Rental } from "../lib/api";

const ACCOUNT_KEY = "paradox_account_id";

export default function HomePage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [areaCode, setAreaCode] = useState("");

  // Restore or create account on first visit
  useEffect(() => {
    const saved = localStorage.getItem(ACCOUNT_KEY);
    if (saved) {
      // We only store the id; re-fetch if needed later
      setAccount({ id: saved, name: "Your account", type: "personal", created_at: "" });
      api.listRentals(saved).then((r) => setRentals(r.rentals)).catch(() => {});
    }
  }, []);

  async function handleCreateAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { account } = await api.createAccount(name || "Personal");
      localStorage.setItem(ACCOUNT_KEY, account.id);
      setAccount(account);
      setSuccess("Account created. You can now rent numbers.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
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
      setError("Create an account first");
      return;
    }
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const result = await api.createRental({
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

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.logo}>Paradox Numbers</h1>
          <p style={styles.tagline}>Connecting Possibilities. Beyond Boundaries.</p>
        </div>
        {account && (
          <div style={styles.accountBadge}>
            <span style={{ opacity: 0.6 }}>Account</span>
            <code style={{ fontSize: 12 }}>{account.id.slice(0, 8)}…</code>
          </div>
        )}
      </header>

      <main style={styles.main}>
        {!account ? (
          <section style={styles.card}>
            <h2 style={styles.h2}>Get started</h2>
            <p style={styles.muted}>
              Create a personal account to rent virtual numbers. Auth will be added next.
            </p>
            <form onSubmit={handleCreateAccount} style={styles.form}>
              <input
                style={styles.input}
                placeholder="Your name or business"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
              <button style={styles.button} type="submit" disabled={loading}>
                {loading ? "Creating…" : "Create account"}
              </button>
            </form>
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
                          {n.capabilities.join(", ")} · ${(n.monthlyCostCents / 100).toFixed(2)}/mo
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
                          {r.status} · ends {new Date(r.current_period_end).toLocaleDateString()}
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
    gap: 2,
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

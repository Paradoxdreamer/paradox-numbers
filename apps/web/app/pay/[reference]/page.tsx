"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Checkout landing page.
 * Until Paystack is fully integrated this page shows the reference and
 * explains webhook-driven activation (no client self-confirm).
 */
export default function PayPage() {
  const params = useParams<{ reference: string }>();
  const router = useRouter();
  const reference = params?.reference ?? "";
  const [copied, setCopied] = useState(false);

  async function copyRef() {
    try {
      await navigator.clipboard.writeText(reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Payment</h1>
        <p style={styles.muted}>
          Your payment was initiated. Complete checkout with your payment
          provider. The number activates only after our billing webhook confirms
          success — the app never self-confirms.
        </p>

        <div style={styles.refBox}>
          <span style={styles.refLabel}>Reference</span>
          <code style={styles.ref}>{reference}</code>
          <button type="button" style={styles.buttonSecondary} onClick={copyRef}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <p style={{ ...styles.muted, marginTop: 20, marginBottom: 0 }}>
          When Paystack is connected, this page will redirect into their
          checkout. Until then, ops can complete a test payment by calling{" "}
          <code>POST /api/v1/billing/webhook</code> with header{" "}
          <code>x-billing-secret</code>.
        </p>

        <button
          type="button"
          style={{ ...styles.button, marginTop: 24 }}
          onClick={() => router.push("/")}
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "var(--bg, #0b0f14)",
    color: "var(--text, #e8eef7)",
  },
  card: {
    maxWidth: 480,
    width: "100%",
    background: "var(--surface, #121820)",
    border: "1px solid var(--border, #243041)",
    borderRadius: 12,
    padding: 28,
  },
  h1: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 12,
  },
  muted: {
    color: "var(--text-muted, #9aa8bc)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  refBox: {
    marginTop: 20,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: 14,
    background: "var(--surface-2, #1a2330)",
    borderRadius: 8,
  },
  refLabel: {
    fontSize: 12,
    color: "var(--text-muted, #9aa8bc)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  ref: {
    fontSize: 14,
    wordBreak: "break-all",
  },
  button: {
    background: "var(--accent, #3b82f6)",
    color: "white",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonSecondary: {
    alignSelf: "flex-start",
    background: "transparent",
    color: "var(--accent-hover, #60a5fa)",
    border: "1px solid var(--border, #243041)",
    borderRadius: 8,
    padding: "6px 12px",
    fontWeight: 500,
    cursor: "pointer",
  },
};

"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Checkout landing page.
 * Until Paystack (or another PSP) is fully integrated, this page:
 * - Shows the payment reference
 * - Explains that completion is webhook-driven
 * - Offers a local-dev note for simulating the billing webhook
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

        <p style={{ ...styles.muted, marginTop: 20 }}>
          Live Paystack checkout will open here once{
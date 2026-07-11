"use client";

import { useState } from "react";
import { registerForEventPublic, type PublicRegisterResult } from "./actions";
import styles from "./event.module.css";

export type FreeTierOption = { id: string; title: string; description: string | null };

// Free registration form. Paid tiers never reach this component — the page
// routes them to the bespoke landing page or /contact until Stripe lands in
// PR 5. When an event's only tiers are paid, the form is replaced by a
// pointer to those CTAs.
export function RegisterForm({
  slug,
  freeTiers,
  hasOnlyPaidTiers,
}: {
  slug: string;
  freeTiers: FreeTierOption[];
  hasOnlyPaidTiers: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [guests, setGuests] = useState("0");
  const [tierId, setTierId] = useState(freeTiers[0]?.id ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Extract<PublicRegisterResult, { ok: true }> | null>(null);

  if (hasOnlyPaidTiers) {
    return <div className={styles.notice}>Pick a ticket above to reserve your seat.</div>;
  }

  if (done) {
    return (
      <div className={styles.success}>
        <div className={styles.successTitle}>
          {done.status === "waitlisted"
            ? `You're on the waitlist${done.waitlistPosition ? ` — #${done.waitlistPosition}` : ""}`
            : done.alreadyRegistered
              ? "You're already registered"
              : "You're in!"}
        </div>
        <div className={styles.successBody}>
          {done.status === "waitlisted"
            ? "The event is currently full. We'll email you if a seat opens up."
            : "Check your email for confirmation — and here's your ticket:"}
        </div>
        {done.status === "registered" && done.ticketPath && (
          <a className={styles.ticketLink} href={done.ticketPath}>
            View my ticket
          </a>
        )}
      </div>
    );
  }

  async function submit() {
    setPending(true);
    setError(null);
    const r = await registerForEventPublic(slug, {
      name,
      email,
      phone: phone || undefined,
      productId: tierId || null,
      guestCount: Number(guests) || 0,
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setDone(r);
  }

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <h2 className={styles.sectionLabel}>Register</h2>

      {freeTiers.length > 1 && (
        <div className={styles.fieldRow}>
          <span className={styles.fieldLabel}>Ticket</span>
          <div className={styles.tiers}>
            {freeTiers.map((t) => (
              <button
                type="button"
                key={t.id}
                className={`${styles.tier} ${tierId === t.id ? styles.tierActive : ""}`}
                onClick={() => setTierId(t.id)}
              >
                <div>
                  <div className={styles.tierName}>{t.title}</div>
                  {t.description && <div className={styles.tierDesc}>{t.description}</div>}
                </div>
                <span className={styles.free}>Free</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor="reg-name">
          Name
        </label>
        <input id="reg-name" className={styles.input} value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor="reg-email">
          Email
        </label>
        <input
          id="reg-email"
          className={styles.input}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor="reg-phone">
          Phone <span style={{ fontWeight: 400 }}>(optional)</span>
        </label>
        <input id="reg-phone" className={styles.input} value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
      </div>
      <div className={styles.fieldRow}>
        <label className={styles.fieldLabel} htmlFor="reg-guests">
          Guests you're bringing
        </label>
        <input
          id="reg-guests"
          className={styles.input}
          type="number"
          min={0}
          max={4}
          value={guests}
          onChange={(e) => setGuests(e.target.value)}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <button type="submit" className={styles.btnPrimary} disabled={pending}>
        {pending ? "Registering…" : "Register"}
      </button>
      <div className={styles.hint}>You'll get a confirmation email with your ticket link.</div>
    </form>
  );
}

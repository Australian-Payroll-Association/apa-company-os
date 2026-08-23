"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { BrandProfile } from "@/lib/admin/brand-profiles";
import { saveBrandProfile } from "./actions";

type Note = { tone: "ok" | "err"; text: string } | null;

export function BrandProfileEditor({ profile }: { profile: BrandProfile }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<Note>(null);

  const [positioning, setPositioning] = useState(profile.positioning ?? "");
  const [audience, setAudience] = useState(profile.audience ?? "");
  const [offer, setOffer] = useState(profile.offer ?? "");
  const [primaryCta, setPrimaryCta] = useState(profile.primaryCta ?? "");
  const [voiceMd, setVoiceMd] = useState(profile.voiceMd ?? "");
  const [contentRulesMd, setContentRulesMd] = useState(profile.contentRulesMd ?? "");

  function save() {
    setNote(null);
    startTransition(async () => {
      const r = await saveBrandProfile(profile.brandId, {
        positioning,
        audience,
        offer,
        primaryCta,
        voiceMd,
        contentRulesMd,
      });
      if (r.ok) {
        setNote({ tone: "ok", text: "Saved." });
        router.refresh();
      } else {
        setNote({ tone: "err", text: r.error });
      }
    });
  }

  return (
    <section className="admin-card admin-section-card">
      <div className="admin-card-title">{profile.brandName}</div>
      {note && (
        <div className={`admin-alert admin-alert--${note.tone}`} style={{ marginTop: 8 }}>
          {note.text}
        </div>
      )}
      <div className="admin-form" style={{ marginTop: 12 }}>
        <div className="admin-field">
          <label className="admin-label">Positioning</label>
          <textarea className="admin-textarea" rows={2} value={positioning} onChange={(e) => setPositioning(e.target.value)} placeholder="What the brand is and what it sells." />
        </div>
        <div className="admin-field">
          <label className="admin-label">Audience</label>
          <textarea className="admin-textarea" rows={2} value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="Who we are writing to." />
        </div>
        <div className="admin-field">
          <label className="admin-label">Offer</label>
          <input className="admin-input" value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="What we sell." />
        </div>
        <div className="admin-field">
          <label className="admin-label">Primary CTA</label>
          <input className="admin-input" value={primaryCta} onChange={(e) => setPrimaryCta(e.target.value)} placeholder="The default call to action." />
        </div>
        <div className="admin-field">
          <label className="admin-label">Voice</label>
          <textarea className="admin-textarea" rows={4} value={voiceMd} onChange={(e) => setVoiceMd(e.target.value)} placeholder="Tone and voice guidance." />
        </div>
        <div className="admin-field">
          <label className="admin-label">Content rules (the writer's playbook)</label>
          <textarea className="admin-textarea" rows={12} value={contentRulesMd} onChange={(e) => setContentRulesMd(e.target.value)} placeholder="What to produce and how. The AI writer follows this." />
          <div className="admin-hint">
            Markdown. This drives the AI writer: what deliverables to produce, the lens, and the per-channel rules. Nothing is hardwired in code.
          </div>
        </div>
        <div className="admin-form-actions">
          <button type="button" className="admin-btn admin-btn--primary" disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>
    </section>
  );
}

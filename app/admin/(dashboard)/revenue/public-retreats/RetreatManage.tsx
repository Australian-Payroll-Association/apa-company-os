"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatCents, humanize } from "@/lib/admin/format";
import { deleteRetreat, updateRetreat } from "./actions";

export type RetreatTier = {
  id: string;
  tier: string | null;
  title: string;
  amountCents: number;
  currency: string;
  active: boolean;
};

export type RetreatAttendee = {
  name: string | null;
  email: string | null;
  tier: string | null;
  status: string | null;
  personId: string | null;
};

export type RetreatManageData = {
  id: string; // = cohort_slug
  cohortSlug: string;
  name: string;
  location: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  active: boolean;
  fromUsdCents: number | null;
  collectedUsdCents: number | null;
  registrations: number;
  confirmed: number;
  tiers: RetreatTier[];
  attendees: RetreatAttendee[];
};

const toDateInput = (v: string | null) => (v ? v.slice(0, 10) : "");

// Manage surface for one retreat, rendered in the list row's side shelf:
// edit the cohort-shared fields in place, see every tier and registered
// guest, and delete the retreat when nothing references it yet. Edits fan
// out to all tiers in the cohort (they share location, dates, and status).
export function RetreatManage({ retreat }: { retreat: RetreatManageData }) {
  const router = useRouter();

  const [location, setLocation] = useState(retreat.location ?? "");
  const [dateStart, setDateStart] = useState(toDateInput(retreat.dateStart));
  const [dateEnd, setDateEnd] = useState(toDateInput(retreat.dateEnd));
  const [active, setActive] = useState(retreat.active);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const hasHistory = retreat.registrations > 0;

  async function save() {
    setSaving(true);
    setMsg(null);
    const r = await updateRetreat(retreat.cohortSlug, {
      location: location || null,
      date_start: dateStart || null,
      date_end: dateEnd || null,
      active,
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Status</dt>
        <dd>{retreat.active ? <Badge tone="ok">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}</dd>
        <dt>Cohort</dt>
        <dd className="admin-cell-mono">{retreat.cohortSlug}</dd>
        <dt>From</dt>
        <dd className="admin-cell-mono">{formatCents(retreat.fromUsdCents, "usd")}</dd>
        <dt>Collected</dt>
        <dd className="admin-cell-mono">{formatCents(retreat.collectedUsdCents, "usd")}</dd>
        <dt>Registered</dt>
        <dd>
          {retreat.confirmed} confirmed
          {retreat.registrations > retreat.confirmed ? ` · ${retreat.registrations} total` : ""}
        </dd>
      </dl>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>}

        <div className="admin-field">
          <label className="admin-label">Location</label>
          <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Start date</label>
            <input className="admin-input" type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">End date</label>
            <input className="admin-input" type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Status</label>
          <select className="admin-select" value={active ? "active" : "inactive"} onChange={(e) => setActive(e.target.value === "active")}>
            <option value="active">Active — open for registration</option>
            <option value="inactive">Inactive — hidden from sale</option>
          </select>
        </div>
        <div className="admin-hint">
          Changes apply to all {retreat.tiers.length} tier{retreat.tiers.length === 1 ? "" : "s"} in this cohort. The
          retreat name comes from the city part of Location.
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tiers
        </div>
        <div className="admin-list">
          {retreat.tiers.map((t) => (
            <div className="admin-list-row" key={t.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{t.title}</div>
                <div className="admin-list-sub">{t.tier ? humanize(t.tier) : "—"}</div>
              </div>
              <div className="admin-list-aside">
                <span className="admin-cell-mono">{formatCents(t.amountCents, t.currency)}</span>{" "}
                {!t.active && <Badge tone="neutral">Inactive</Badge>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Guest list
        </div>
        {retreat.attendees.length === 0 ? (
          <div className="admin-empty">No registrations yet.</div>
        ) : (
          <div className="admin-list">
            {retreat.attendees.map((a, i) => (
              <div className="admin-list-row" key={i}>
                <div className="admin-list-main">
                  <div className="admin-list-title">
                    {a.personId ? (
                      <Link href={`/admin/contacts/${a.personId}`} className="admin-cell-strong">
                        {a.name || a.email || "Attendee"}
                      </Link>
                    ) : (
                      a.name || a.email || "Attendee"
                    )}
                  </div>
                  <div className="admin-list-sub">
                    {[a.tier ? humanize(a.tier) : null, a.email].filter(Boolean).join(" · ") || "—"}
                  </div>
                </div>
                <div className="admin-list-aside">
                  {a.status ? <Badge tone={statusTone(a.status)}>{humanize(a.status)}</Badge> : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-danger-zone" style={{ marginTop: 18 }}>
        <div className="admin-danger-zone-title">Danger zone</div>
        <div className="admin-danger-row">
          <span className="admin-danger-row-text">
            {hasHistory
              ? `Delete is blocked while ${retreat.registrations} registration${retreat.registrations === 1 ? "" : "s"} reference this retreat — set it inactive instead.`
              : "Permanently delete this retreat and all its tiers. Cannot be undone."}
          </span>
          <ConfirmButton
            label="Delete permanently"
            title="Permanently delete this retreat?"
            body={
              <>
                This deletes <strong>{retreat.name}</strong> and its {retreat.tiers.length} tier
                {retreat.tiers.length === 1 ? "" : "s"}. This cannot be undone.
              </>
            }
            confirmLabel="Delete permanently"
            onConfirm={() => deleteRetreat(retreat.cohortSlug)}
            onDone={() => router.refresh()}
          />
        </div>
      </div>
    </>
  );
}

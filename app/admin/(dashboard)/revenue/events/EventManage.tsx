"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, statusTone } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatCents, humanize } from "@/lib/admin/format";
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  EVENT_VISIBILITIES,
  tierPriceLabel,
  type EventType,
  type EventStatus,
  type EventVisibility,
} from "@/lib/events";
import {
  addEventTier,
  addEventVideo,
  archiveEvent,
  getEventSignupQr,
  moveEventMedia,
  removeEventMedia,
  restoreEvent,
  setTierActive,
  updateEvent,
  uploadEventImage,
} from "./actions";
import { eventStatusBadge, type EventRow } from "./EventsTable";

export type EventTierRow = {
  id: string;
  title: string;
  tier: string | null;
  description: string | null;
  amountCents: number;
  currency: string;
  capacity: number | null;
  active: boolean;
};

export type EventAttendee = {
  name: string | null;
  email: string | null;
  tier: string | null;
  status: string;
  personId: string | null;
  guestCount: number;
  checkedInAt: string | null;
};

const toDateInput = (v: string | null) => (v ? v.slice(0, 10) : "");

// Manage surface for one event, rendered in the list row's side shelf: edit
// the event's own fields (single-row write — no more cohort fan-out), review
// tiers and the attendee roster, share the signup link/QR, and archive when
// nothing references it. Archiving is reversible (archived_at), so it's the
// only "danger zone" action here — no hard delete (event_id FKs on tiers and
// registrations are ON DELETE SET NULL, which would silently orphan them).
export function EventManage({ event }: { event: EventRow }) {
  const router = useRouter();

  const [title, setTitle] = useState(event.title);
  const [type, setType] = useState<EventType>(event.type);
  const [status, setStatus] = useState<EventStatus>(event.status);
  const [visibility, setVisibility] = useState<EventVisibility>(event.visibility);
  const [location, setLocation] = useState(event.location ?? "");
  const [startsAt, setStartsAt] = useState(toDateInput(event.startsAt));
  const [endsAt, setEndsAt] = useState(toDateInput(event.endsAt));
  const [capacity, setCapacity] = useState(event.capacity?.toString() ?? "");
  const [landingPath, setLandingPath] = useState(event.landingPath ?? "");
  const [notes, setNotes] = useState(event.notes ?? "");
  const [blurb, setBlurb] = useState(event.blurb ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [qr, setQr] = useState<{ url: string; png: string } | null>(null);
  const [qrLoading, setQrLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setQr(null);
    setQrLoading(true);
    getEventSignupQr(event.slug).then((r) => {
      if (!cancelled && r.ok) setQr({ url: r.url, png: r.png });
      if (!cancelled) setQrLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [event.slug]);

  const isArchived = !!event.archivedAt;
  const hasHistory = event.totalCount > 0;

  async function save() {
    setSaving(true);
    setMsg(null);
    const cap = capacity.trim() === "" ? null : Number(capacity);
    if (cap !== null && (!Number.isFinite(cap) || cap < 0)) {
      setSaving(false);
      return setMsg({ ok: false, text: "Capacity must be a non-negative number, or blank for uncapped." });
    }
    const r = await updateEvent(event.id, {
      title: title.trim(),
      type,
      status,
      visibility,
      location: location || null,
      starts_at: startsAt || null,
      ends_at: endsAt || null,
      capacity: cap,
      landing_path: landingPath || null,
      notes: notes || null,
      blurb: blurb || null,
      description: description || null,
    });
    setSaving(false);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: "Saved." });
    router.refresh();
  }

  async function copyLink() {
    if (!qr) return;
    await navigator.clipboard.writeText(qr.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <>
      <dl className="admin-kv" style={{ marginBottom: 16 }}>
        <dt>Status</dt>
        <dd>{eventStatusBadge(event.status, event.archivedAt)}</dd>
        <dt>Slug</dt>
        <dd className="admin-cell-mono">{event.slug}</dd>
        <dt>From</dt>
        <dd className="admin-cell-mono">{event.tiers.length === 0 ? "Free" : formatCents(event.fromUsdCents, "usd")}</dd>
        <dt>Collected</dt>
        <dd className="admin-cell-mono">{formatCents(event.collectedUsdCents, "usd")}</dd>
        <dt>Registered</dt>
        <dd>
          {event.registeredCount} seats
          {event.totalCount > event.registeredCount ? ` · ${event.totalCount} total rows` : ""}
        </dd>
      </dl>

      <Link href={`/admin/revenue/events/${event.id}`} className="admin-btn" style={{ marginBottom: 16, display: "inline-block" }}>
        Open full event page →
      </Link>

      <div style={{ marginBottom: 16 }}>
        <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Signup link
        </div>
        {qrLoading ? (
          <div className="admin-empty">Generating…</div>
        ) : qr ? (
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <img src={qr.png} alt={`QR code for ${qr.url}`} width={96} height={96} style={{ borderRadius: 8, border: "1px solid var(--admin-border, #e2e2e8)" }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <code className="admin-cell-mono" style={{ wordBreak: "break-all" }}>
                {qr.url}
              </code>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" className="admin-btn" onClick={copyLink}>
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <a className="admin-btn" href={qr.png} download={`${event.slug}-signup-qr.png`}>
                  Download PNG
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="admin-empty">Couldn't generate the QR.</div>
        )}
      </div>

      <form
        className="admin-form"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {msg && <div className={`admin-alert ${msg.ok ? "admin-alert--ok" : "admin-alert--err"}`}>{msg.text}</div>}

        <div className="admin-field">
          <label className="admin-label">Title</label>
          <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div className="admin-field">
          <label className="admin-label">One-line blurb</label>
          <input
            className="admin-input"
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            placeholder="Shown on cards and link previews"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Full description</label>
          <textarea
            className="admin-input"
            rows={7}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="The long-form pitch shown on the signup page. Blank lines start a new paragraph."
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Type</label>
            <select className="admin-select" value={type} onChange={(e) => setType(e.target.value as EventType)}>
              {EVENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>
          <div className="admin-field">
            <label className="admin-label">Visibility</label>
            <select className="admin-select" value={visibility} onChange={(e) => setVisibility(e.target.value as EventVisibility)}>
              {EVENT_VISIBILITIES.map((v) => (
                <option key={v} value={v}>
                  {humanize(v)}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Status</label>
          <select className="admin-select" value={status} onChange={(e) => setStatus(e.target.value as EventStatus)}>
            {EVENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {humanize(s)}
              </option>
            ))}
          </select>
          <div className="admin-hint">Only "Open" accepts new registrations.</div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Location</label>
          <input className="admin-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City, Country" />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div className="admin-field">
            <label className="admin-label">Start date</label>
            <input className="admin-input" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          </div>
          <div className="admin-field">
            <label className="admin-label">End date</label>
            <input className="admin-input" type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Capacity</label>
          <input
            className="admin-input"
            type="number"
            min={0}
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            placeholder="Uncapped"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Bespoke landing page (optional)</label>
          <input className="admin-input" value={landingPath} onChange={(e) => setLandingPath(e.target.value)} placeholder="/saigon-private" />
        </div>
        <div className="admin-field">
          <label className="admin-label">Notes</label>
          <textarea className="admin-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="admin-form-actions">
          <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <TiersSection event={event} onChanged={() => router.refresh()} setShelfMsg={setMsg} />

      <MediaSection event={event} onChanged={() => router.refresh()} />

      <div style={{ marginTop: 16 }}>
        <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Guest list
        </div>
        {event.attendees.length === 0 ? (
          <div className="admin-empty">No registrations yet.</div>
        ) : (
          <div className="admin-list">
            {event.attendees.map((a, i) => (
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
                    {[a.tier ? humanize(a.tier) : null, a.email, a.guestCount ? `+${a.guestCount} guest${a.guestCount === 1 ? "" : "s"}` : null]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </div>
                </div>
                <div className="admin-list-aside">
                  <Badge tone={statusTone(a.status)}>{humanize(a.status)}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="admin-danger-zone" style={{ marginTop: 18 }}>
        <div className="admin-danger-zone-title">Danger zone</div>
        {isArchived ? (
          <div className="admin-danger-row">
            <span className="admin-danger-row-text">This event is archived and hidden from the default list.</span>
            <button
              type="button"
              className="admin-btn"
              onClick={async () => {
                const r = await restoreEvent(event.id);
                if (r.ok) router.refresh();
                else setMsg({ ok: false, text: r.error });
              }}
            >
              Restore
            </button>
          </div>
        ) : (
          <div className="admin-danger-row">
            <span className="admin-danger-row-text">
              {hasHistory
                ? `Archiving is blocked while ${event.totalCount} registration${event.totalCount === 1 ? "" : "s"} reference this event — set status to Cancelled or Closed instead.`
                : "Archive this event. Reversible — it's hidden from the default list but nothing is deleted."}
            </span>
            <ConfirmButton
              label="Archive"
              title="Archive this event?"
              body={
                <>
                  This hides <strong>{event.title}</strong> from the default Events list. You can restore it later.
                </>
              }
              confirmLabel="Archive"
              disabled={hasHistory}
              onConfirm={() => archiveEvent(event.id)}
              onDone={() => router.refresh()}
            />
          </div>
        )}
      </div>
    </>
  );
}

// Tier list + add form. A tier's price is immutable once it can be bought —
// deactivate and add a new tier to reprice — so the only per-tier action is
// the active toggle.
function TiersSection({
  event,
  onChanged,
  setShelfMsg,
}: {
  event: EventRow;
  onChanged: () => void;
  setShelfMsg: (m: { ok: boolean; text: string } | null) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("0");
  const [capacity, setCapacity] = useState("");
  const [description, setDescription] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function submit() {
    setPending(true);
    setError(null);
    const r = await addEventTier(event.id, {
      title,
      amountUsd: Number(price) || 0,
      capacity: capacity.trim() === "" ? null : Number(capacity),
      description: description || null,
    });
    setPending(false);
    if (!r.ok) return setError(r.error);
    setTitle("");
    setPrice("0");
    setCapacity("");
    setDescription("");
    setShowAdd(false);
    onChanged();
  }

  async function toggle(tierId: string, active: boolean) {
    setTogglingId(tierId);
    const r = await setTierActive(event.id, tierId, active);
    setTogglingId(null);
    if (!r.ok) setShelfMsg({ ok: false, text: r.error });
    else onChanged();
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}
      >
        <div className="admin-cell-muted" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          Tickets
        </div>
        <button type="button" className="admin-btn" onClick={() => setShowAdd((v) => !v)}>
          {showAdd ? "Cancel" : "Add ticket"}
        </button>
      </div>

      {showAdd && (
        <form
          className="admin-form"
          style={{ marginBottom: 12 }}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          {error && <div className="admin-alert admin-alert--err">{error}</div>}
          <div className="admin-field">
            <label className="admin-label">Ticket name</label>
            <input className="admin-input" value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="General admission" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div className="admin-field">
              <label className="admin-label">Price (USD)</label>
              <input
                className="admin-input"
                type="number"
                min={0}
                step="1"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
              <div className="admin-hint">0 = free ticket</div>
            </div>
            <div className="admin-field">
              <label className="admin-label">Seats for this ticket</label>
              <input
                className="admin-input"
                type="number"
                min={1}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="Uncapped"
              />
            </div>
          </div>
          <div className="admin-field">
            <label className="admin-label">What's included (optional)</label>
            <input className="admin-input" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="admin-form-actions">
            <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
              {pending ? "Adding…" : "Add ticket"}
            </button>
          </div>
        </form>
      )}

      {event.tiers.length === 0 ? (
        <div className="admin-empty">No tickets — the event registers as free.</div>
      ) : (
        <div className="admin-list">
          {event.tiers.map((t) => (
            <div className="admin-list-row" key={t.id}>
              <div className="admin-list-main">
                <div className="admin-list-title">{t.title}</div>
                <div className="admin-list-sub">
                  {[t.description, t.capacity ? `${t.capacity} seats` : null].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="admin-list-aside" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="admin-cell-mono">{tierPriceLabel({ amount_cents: t.amountCents, currency: t.currency })}</span>
                {!t.active && <Badge tone="neutral">Inactive</Badge>}
                <button
                  type="button"
                  className="admin-btn"
                  disabled={togglingId === t.id}
                  onClick={() => toggle(t.id, !t.active)}
                >
                  {t.active ? "Deactivate" : "Activate"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="admin-hint" style={{ marginTop: 6 }}>
        Prices are fixed once a ticket is on sale — deactivate it and add a new one to reprice.
      </div>
    </div>
  );
}

// Cover image + ordered media gallery (images uploaded to the public
// event-media bucket, videos by URL). Everything here writes immediately —
// it's not part of the Save form above.
function MediaSection({ event, onChanged }: { event: EventRow; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoCaption, setVideoCaption] = useState("");
  const [imageCaption, setImageCaption] = useState("");

  async function upload(file: File, target: "cover" | "gallery") {
    setBusy(target);
    setError(null);
    const fd = new FormData();
    fd.set("file", file);
    fd.set("target", target);
    if (target === "gallery" && imageCaption) fd.set("caption", imageCaption);
    const r = await uploadEventImage(event.id, fd);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setImageCaption("");
    onChanged();
  }

  async function submitVideo() {
    setBusy("video");
    setError(null);
    const r = await addEventVideo(event.id, videoUrl, videoCaption || null);
    setBusy(null);
    if (!r.ok) return setError(r.error);
    setVideoUrl("");
    setVideoCaption("");
    onChanged();
  }

  async function run(label: string, fn: () => Promise<{ ok: boolean }>) {
    setBusy(label);
    setError(null);
    await fn();
    setBusy(null);
    onChanged();
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Cover image
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 14 }}>
        {event.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={event.coverImageUrl}
            alt="Cover"
            width={96}
            height={64}
            style={{ borderRadius: 8, objectFit: "cover", border: "1px solid var(--admin-border, #e2e2e8)" }}
          />
        ) : (
          <span className="admin-cell-muted">None — the signup page renders without a hero.</span>
        )}
        <label className="admin-btn" style={{ cursor: "pointer" }}>
          {busy === "cover" ? "Uploading…" : event.coverImageUrl ? "Replace" : "Upload"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "cover");
              e.target.value = "";
            }}
          />
        </label>
        {event.coverImageUrl && (
          <button
            type="button"
            className="admin-btn"
            disabled={busy !== null}
            onClick={() => run("cover-clear", () => updateEvent(event.id, { cover_image_url: null }))}
          >
            Remove
          </button>
        )}
      </div>

      <div className="admin-cell-muted" style={{ marginBottom: 6, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Gallery & video
      </div>
      {error && <div className="admin-alert admin-alert--err" style={{ marginBottom: 8 }}>{error}</div>}

      {event.media.length === 0 ? (
        <div className="admin-empty">No media yet.</div>
      ) : (
        <div className="admin-list">
          {event.media.map((m, i) => (
            <div className="admin-list-row" key={`${m.url}-${i}`}>
              <div className="admin-list-main" style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                {m.kind === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.url} alt={m.caption ?? ""} width={56} height={40} style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <span style={{ flexShrink: 0 }}>🎬</span>
                )}
                <div style={{ minWidth: 0 }}>
                  <div className="admin-list-title" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.caption || m.url}
                  </div>
                  <div className="admin-list-sub">{m.kind}</div>
                </div>
              </div>
              <div className="admin-list-aside" style={{ display: "flex", gap: 4 }}>
                <button type="button" className="admin-btn" disabled={busy !== null || i === 0} onClick={() => run("move", () => moveEventMedia(event.id, i, "up"))} aria-label="Move up">
                  ↑
                </button>
                <button
                  type="button"
                  className="admin-btn"
                  disabled={busy !== null || i === event.media.length - 1}
                  onClick={() => run("move", () => moveEventMedia(event.id, i, "down"))}
                  aria-label="Move down"
                >
                  ↓
                </button>
                <button type="button" className="admin-btn" disabled={busy !== null} onClick={() => run("remove", () => removeEventMedia(event.id, i))}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
        <input
          className="admin-input"
          style={{ maxWidth: 220 }}
          placeholder="Caption (optional)"
          value={imageCaption}
          onChange={(e) => setImageCaption(e.target.value)}
        />
        <label className="admin-btn" style={{ cursor: "pointer" }}>
          {busy === "gallery" ? "Uploading…" : "Upload image"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            disabled={busy !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f, "gallery");
              e.target.value = "";
            }}
          />
        </label>
      </div>

      <form
        style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}
        onSubmit={(e) => {
          e.preventDefault();
          submitVideo();
        }}
      >
        <input
          className="admin-input"
          style={{ maxWidth: 260 }}
          type="url"
          placeholder="YouTube / Vimeo / .mp4 URL"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          required
        />
        <input
          className="admin-input"
          style={{ maxWidth: 180 }}
          placeholder="Caption (optional)"
          value={videoCaption}
          onChange={(e) => setVideoCaption(e.target.value)}
        />
        <button type="submit" className="admin-btn" disabled={busy !== null}>
          {busy === "video" ? "Adding…" : "Add video"}
        </button>
      </form>
    </div>
  );
}

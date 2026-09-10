"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EditionBroadcast, PublishReadiness } from "@/lib/admin/newsletter-publish";
import { handToBroadcast, markPublished } from "../actions";

// Publish. The handover, and nothing more.
//
// There is deliberately no Send button on this page. /admin already has a send
// pipeline with its own gate — approveBroadcast refuses a broadcast with no
// body or no recipient list, resolveAudience is the one place that decides who
// may receive marketing mail, and the cron worker re-checks every address
// against the live CRM before sending. A second route to a member's inbox with
// different rules is the one thing a marketing system must never have.
//
// So this hands over a draft and points at the editor where those safeguards
// live.

type Msg = { tone: "ok" | "err"; text: string } | null;

export function PublishPanel({
  editionId,
  clearedToSend,
  broadcast,
  readiness,
}: {
  editionId: string;
  clearedToSend: boolean;
  broadcast: EditionBroadcast | null;
  readiness: PublishReadiness;
}) {
  const router = useRouter();
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; message?: string; error?: string }>) {
    setMsg(null);
    start(async () => {
      const result = await fn();
      if (result.ok) {
        if (result.message) setMsg({ tone: "ok", text: result.message });
        router.refresh();
      } else {
        setMsg({ tone: "err", text: result.error ?? "That didn't work." });
      }
    });
  }

  return (
    <div className="admin-card" style={{ padding: "20px 22px", marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
        <h2 className="admin-card-title" style={{ margin: 0 }}>
          Publish
        </h2>
        {broadcast && <span className="admin-cell-muted">broadcast {broadcast.status}</span>}
      </div>

      <p className="admin-page-sub" style={{ marginTop: 6 }}>
        A signed-off edition is handed to the broadcast system as a draft. Nothing sends from this
        page &mdash; you build the recipient list and approve the send in the broadcast editor,
        where the audience rules and the pre-send checks live.
      </p>

      {/* Configuration first. Handing over into a pipeline that cannot send,
          or would send from the wrong address, wastes the reviewer's time and
          in the postal-address case would be a compliance problem. */}
      {!readiness.ok && (
        <div className="admin-alert admin-alert--warn" style={{ marginTop: 12 }}>
          <strong style={{ display: "block", marginBottom: 6 }}>
            Sending is not configured yet
          </strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {readiness.checks
              .filter((c) => !c.ok)
              .map((c) => (
                <li key={c.label} style={{ marginBottom: 4 }}>
                  <strong>{c.label}:</strong> {c.detail}
                </li>
              ))}
          </ul>
          <p style={{ margin: "8px 0 0" }}>
            You can still create the broadcast &mdash; it is a draft and cannot go anywhere until
            these are set.
          </p>
        </div>
      )}

      {!clearedToSend && !broadcast && (
        <p className="admin-page-sub" style={{ marginTop: 10, marginBottom: 0, fontSize: 12 }}>
          Not signed off yet. Two signatures, from two different people, are needed first.
        </p>
      )}

      {broadcast && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
            <span className="admin-label" style={{ minWidth: 130 }}>
              Broadcast
            </span>
            <Link href={`/admin/revenue/marketing/broadcasts/${broadcast.id}`}>
              {broadcast.name}
            </Link>
            <span className="admin-cell-muted" style={{ fontSize: 12 }}>
              {broadcast.status}
              {" · "}
              {broadcast.recipientCount} recipient{broadcast.recipientCount === 1 ? "" : "s"}
              {broadcast.sentAt && ` · sent ${new Date(broadcast.sentAt).toLocaleDateString("en-AU")}`}
            </span>
          </div>
          {broadcast.recipientCount === 0 && broadcast.status === "draft" && (
            <p className="admin-page-sub" style={{ margin: "8px 0 0", fontSize: 12 }}>
              No recipients built yet. Open the broadcast to choose the audience and approve it.
            </p>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {!broadcast && (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={pending || !clearedToSend}
            onClick={() => act(() => handToBroadcast(editionId))}
          >
            {pending ? "Creating…" : "Create the broadcast"}
          </button>
        )}

        {/* Only once the broadcast has actually gone. An edition marked
            published while its broadcast sits unapproved is a lie the rest of
            the system would repeat. */}
        {broadcast?.status === "sent" && (
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            disabled={pending}
            onClick={() => act(() => markPublished(editionId))}
          >
            {pending ? "Saving…" : "Mark this edition published"}
          </button>
        )}
      </div>

      {msg && (
        <div
          className={`admin-alert ${msg.tone === "ok" ? "admin-alert--ok" : "admin-alert--err"}`}
          style={{ marginTop: 10 }}
        >
          {msg.text}
        </div>
      )}
    </div>
  );
}

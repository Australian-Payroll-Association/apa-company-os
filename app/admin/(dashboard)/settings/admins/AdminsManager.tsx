"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/admin/Badge";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { formatDate } from "@/lib/admin/format";
import type { AdminListRow } from "@/lib/admin/admins";
import { addAdmin, deleteAdmin, resendAccessLink, updateAdmin } from "./actions";

type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

export function AdminsManager({
  rows,
  currentEmail,
}: {
  rows: AdminListRow[];
  currentEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");

  // Row being edited in the modal, with its draft field values.
  const [editing, setEditing] = useState<{ id: string; email: string; name: string } | null>(null);

  function run(fn: () => Promise<ActionResult>, fallbackOk: string, after?: () => void) {
    setBanner(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) {
        setBanner({ tone: "ok", text: res.message ?? fallbackOk });
        after?.();
        router.refresh();
      } else {
        setBanner({ tone: "err", text: res.error });
      }
    });
  }

  function submitAdd(e: React.FormEvent) {
    e.preventDefault();
    run(() => addAdmin(newEmail, newName), "Admin added.", () => {
      setNewEmail("");
      setNewName("");
    });
  }

  function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    run(
      () => updateAdmin(editing.id, { displayName: editing.name, email: editing.email }),
      "Admin updated.",
      () => setEditing(null),
    );
  }

  function loginStatus(r: AdminListRow) {
    if (r.lastSignInAt) return <Badge tone="ok">Active</Badge>;
    if (r.hasLogin) return <Badge tone="info">Invited</Badge>;
    return <Badge tone="warn">No login yet</Badge>;
  }

  return (
    <>
      {banner && (
        <div className={`admin-alert admin-alert--${banner.tone}`}>{banner.text}</div>
      )}

      <div className="admin-card admin-section-card" style={{ marginBottom: 20 }}>
        <h2 className="admin-card-title">Add an admin</h2>
        <form className="admin-form" onSubmit={submitAdd}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="admin-field" style={{ flex: "1 1 220px", marginBottom: 0 }}>
              <label className="admin-label" htmlFor="adm-email">Email</label>
              <input
                id="adm-email"
                className="admin-input"
                type="email"
                required
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="admin-field" style={{ flex: "1 1 180px", marginBottom: 0 }}>
              <label className="admin-label" htmlFor="adm-name">Name (optional)</label>
              <input
                id="adm-name"
                className="admin-input"
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
              {pending ? "Working…" : "Add & send invite"}
            </button>
          </div>
        </form>
        <p className="admin-cell-muted" style={{ marginTop: 10, marginBottom: 0, fontSize: 13 }}>
          They get an email link to set their password, then full access to this console.
        </p>
      </div>

      <div className="admin-table-wrap">
        <div className="admin-table-scroll">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Admin</th>
                <th>Login</th>
                <th>Last sign-in</th>
                <th>Added</th>
                <th aria-label="Actions"></th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className="admin-empty">No admins yet.</div>
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const isSelf = r.email.toLowerCase() === currentEmail.toLowerCase();
                  return (
                    <tr key={r.id ?? `env-${r.email}`}>
                      <td>
                        <div className="admin-cell-strong">{r.displayName || r.email}</div>
                        {r.displayName && <div className="admin-cell-muted">{r.email}</div>}
                        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                          {isSelf && <Badge tone="info">You</Badge>}
                          {r.source !== "db" && (
                            <span title="Also granted by the ADMIN_ALLOWLIST env var — removing the row here won't revoke access until the env var changes too.">
                              <Badge>Env allowlist</Badge>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{loginStatus(r)}</td>
                      <td className="admin-cell-muted">
                        {r.lastSignInAt ? formatDate(r.lastSignInAt) : "—"}
                      </td>
                      <td className="admin-cell-muted">
                        {r.createdAt ? formatDate(r.createdAt) : "—"}
                        {r.createdBy && <div>by {r.createdBy}</div>}
                      </td>
                      <td>
                        {r.id ? (
                          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                            <button
                              className="admin-btn admin-btn--sm"
                              disabled={pending}
                              onClick={() =>
                                setEditing({ id: r.id!, email: r.email, name: r.displayName ?? "" })
                              }
                            >
                              Edit
                            </button>
                            <button
                              className="admin-btn admin-btn--sm"
                              disabled={pending}
                              onClick={() =>
                                run(() => resendAccessLink(r.id!), "Access link sent.")
                              }
                            >
                              {r.hasLogin ? "Send reset link" : "Resend invite"}
                            </button>
                            {!isSelf && (
                              <ConfirmButton
                                className="admin-btn admin-btn--sm admin-btn--danger"
                                label="Remove"
                                title="Remove admin access"
                                body={
                                  <>
                                    <strong>{r.displayName || r.email}</strong> will immediately lose
                                    access to this console. Their login is kept and they can be
                                    re-added later.
                                    {r.source === "both" && (
                                      <>
                                        {" "}They are also in the <code>ADMIN_ALLOWLIST</code> env
                                        var, which still grants access until it is updated on Vercel.
                                      </>
                                    )}
                                  </>
                                }
                                confirmLabel="Remove access"
                                onConfirm={() => deleteAdmin(r.id!)}
                                onDone={() => {
                                  setBanner({ tone: "ok", text: `${r.email} removed.` });
                                  router.refresh();
                                }}
                              />
                            )}
                          </div>
                        ) : (
                          <div style={{ textAlign: "right" }}>
                            <span
                              className="admin-cell-muted"
                              title="Managed via the ADMIN_ALLOWLIST env var on Vercel — add them here to manage them from this page."
                            >
                              via env var
                            </span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <div className="admin-modal-backdrop" onClick={() => !pending && setEditing(null)}>
          <div
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Edit admin"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="admin-modal-title">Edit admin</div>
            <form className="admin-form" onSubmit={submitEdit}>
              <div className="admin-field">
                <label className="admin-label" htmlFor="edit-name">Name</label>
                <input
                  id="edit-name"
                  className="admin-input"
                  type="text"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </div>
              <div className="admin-field">
                <label className="admin-label" htmlFor="edit-email">Email</label>
                <input
                  id="edit-email"
                  className="admin-input"
                  type="email"
                  required
                  value={editing.email}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
                <p className="admin-cell-muted" style={{ margin: "6px 0 0", fontSize: 12.5 }}>
                  Changing the email also updates their login — they sign in with the new
                  address afterwards.
                </p>
              </div>
              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() => setEditing(null)}
                  disabled={pending}
                >
                  Cancel
                </button>
                <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
                  {pending ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

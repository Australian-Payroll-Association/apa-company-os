"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadAndRun, type RunFormResult } from "./actions";
import { WorkbookDropzone } from "./WorkbookDropzone";

export type RuleSetOption = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="admin-btn admin-btn--primary" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
      {pending ? "Calculating…" : "Run recalculation"}
    </button>
  );
}

export function UploadForm({ ruleSets }: { ruleSets: RuleSetOption[] }) {
  const [state, formAction] = useFormState<RunFormResult | null, FormData>(uploadAndRun, null);
  return (
    <form action={formAction} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="admin-label" htmlFor="label">
          Label (optional)
        </label>
        <input id="label" name="label" type="text" placeholder="e.g. Acme Pty Ltd — pilot" />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="admin-label" htmlFor="rule_set_id">
          Rule set
        </label>
        <select id="rule_set_id" name="rule_set_id" defaultValue={ruleSets[0]?.id ?? ""} disabled={ruleSets.length === 0}>
          {ruleSets.length === 0 ? (
            <option value="">No rule sets seeded</option>
          ) : (
            ruleSets.map((rs) => (
              <option key={rs.id} value={rs.id}>
                {rs.name}
              </option>
            ))
          )}
        </select>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label className="admin-label">Pay review data gathering workbook</label>
        <WorkbookDropzone name="workbook_file" />
      </div>
      <SubmitButton />
      {state && !state.ok && (
        <div className="admin-alert admin-alert--err" role="alert">
          {state.error}
        </div>
      )}
    </form>
  );
}

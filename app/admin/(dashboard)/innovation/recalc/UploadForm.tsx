"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadAndRun, type RunFormResult } from "./actions";
import { WorkbookDropzone } from "./WorkbookDropzone";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="admin-btn admin-btn--primary" disabled={pending} style={{ width: "100%", justifyContent: "center" }}>
      {pending ? "Calculating…" : "Run recalculation"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useFormState<RunFormResult | null, FormData>(uploadAndRun, null);
  return (
    <form action={formAction} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="admin-field">
        <label className="admin-label" htmlFor="label">
          Label (optional)
        </label>
        <input id="label" name="label" type="text" placeholder="e.g. Acme Pty Ltd — pilot" />
      </div>
      <div className="admin-field">
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

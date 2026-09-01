"use client";

import { useFormState, useFormStatus } from "react-dom";
import { uploadAndRun, type RunFormResult } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary" disabled={pending}>
      {pending ? "Calculating…" : "Run recalculation"}
    </button>
  );
}

export function UploadForm() {
  const [state, formAction] = useFormState<RunFormResult | null, FormData>(uploadAndRun, null);
  return (
    <form action={formAction} className="admin-card" style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 480 }}>
      <div className="admin-field">
        <label className="admin-label" htmlFor="label">
          Label (optional)
        </label>
        <input id="label" name="label" type="text" placeholder="e.g. Acme Pty Ltd — pilot" />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="timesheet_file">
          Timesheet CSV
        </label>
        <input id="timesheet_file" name="timesheet_file" type="file" accept=".csv,text/csv" required />
      </div>
      <div className="admin-field">
        <label className="admin-label" htmlFor="pay_data_file">
          Pay data CSV
        </label>
        <input id="pay_data_file" name="pay_data_file" type="file" accept=".csv,text/csv" required />
      </div>
      <div>
        <SubmitButton />
      </div>
      {state && !state.ok && (
        <div className="admin-alert admin-alert--err" role="alert">
          {state.error}
        </div>
      )}
    </form>
  );
}

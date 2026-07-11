"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOwnContact } from "./actions";

// The employee-editable slice of the profile: preferred name, phone, and
// emergency contact. Everything else on the page is read-only employment data.
export function ProfileForm({
  preferredName,
  phone,
  emergencyContactName,
  emergencyContactPhone,
}: {
  preferredName: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [banner, setBanner] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const [values, setValues] = useState({
    preferredName,
    phone,
    emergencyContactName,
    emergencyContactPhone,
  });

  function set(key: keyof typeof values) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setBanner(null);
    startTransition(async () => {
      const res = await saveOwnContact(values);
      if (res.ok) {
        setBanner({ tone: "ok", text: "Saved." });
        router.refresh();
      } else {
        setBanner({ tone: "err", text: res.error });
      }
    });
  }

  return (
    <form className="admin-form" onSubmit={submit}>
      {banner && (
        <div className={`admin-alert admin-alert--${banner.tone === "ok" ? "ok" : "err"}`}>
          {banner.text}
        </div>
      )}

      <div className="admin-field">
        <label className="admin-label" htmlFor="pf-preferred">Preferred name</label>
        <input
          id="pf-preferred"
          className="admin-input"
          type="text"
          value={values.preferredName}
          onChange={set("preferredName")}
          placeholder="What you like to be called"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="pf-phone">Phone</label>
        <input
          id="pf-phone"
          className="admin-input"
          type="tel"
          value={values.phone}
          onChange={set("phone")}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="pf-ec-name">Emergency contact name</label>
        <input
          id="pf-ec-name"
          className="admin-input"
          type="text"
          value={values.emergencyContactName}
          onChange={set("emergencyContactName")}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label" htmlFor="pf-ec-phone">Emergency contact phone</label>
        <input
          id="pf-ec-phone"
          className="admin-input"
          type="tel"
          value={values.emergencyContactPhone}
          onChange={set("emergencyContactPhone")}
        />
      </div>

      <div className="admin-form-actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

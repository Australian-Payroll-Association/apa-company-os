"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BrandOption, PillarOption } from "@/lib/admin/marketing-calendar";
import { NewCampaignForm } from "./NewCampaignForm";

// Creation lives in a modal so the index page is the list, not a list buried
// under a form. Portalled to the body so the header's stacking context can't
// clip the overlay.
export function NewCampaignButton({ brands, pillars }: { brands: BrandOption[]; pillars: PillarOption[] }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" className="admin-btn admin-btn--primary" onClick={() => setOpen(true)}>
        + New campaign
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="mcr-modal-overlay"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
          >
            <div className="mcr-modal-card">
              <div className="mcr-modal-head">
                <span className="mcr-modal-title">New campaign</span>
                <button type="button" className="admin-btn admin-btn--sm" onClick={() => setOpen(false)}>
                  Close
                </button>
              </div>
              <div className="mcr-modal-body">
                <NewCampaignForm brands={brands} pillars={pillars} />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

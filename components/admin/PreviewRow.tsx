"use client";

import { useState, type ReactNode, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { DetailDrawer } from "./DetailDrawer";

// A clickable table row that opens the record in the side car (DetailDrawer).
// The whole row is the target — no per-cell links — but clicks on genuinely
// interactive elements inside the row (buttons, links, inputs) are left alone so
// inline actions still work. The drawer is portalled to <body> so it never nests
// invalid markup inside <table>.
export function PreviewRow({
  children,
  title,
  eyebrow,
  preview,
  className,
}: {
  children: ReactNode; // the <td> cells for this row
  title: ReactNode;
  eyebrow?: ReactNode;
  preview: ReactNode; // drawer body
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  function onClick(e: MouseEvent<HTMLTableRowElement>) {
    if ((e.target as HTMLElement).closest("a,button,input,select,label,[role=button]")) return;
    setOpen(true);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      if ((e.target as HTMLElement).closest("a,button,input,select,label,[role=button]")) return;
      e.preventDefault();
      setOpen(true);
    }
  }

  return (
    <>
      <tr
        className={`is-clickable${className ? ` ${className}` : ""}`}
        onClick={onClick}
        onKeyDown={onKeyDown}
        tabIndex={0}
        role="button"
        aria-haspopup="dialog"
      >
        {children}
      </tr>
      {open &&
        createPortal(
          <DetailDrawer open onClose={() => setOpen(false)} title={title} eyebrow={eyebrow}>
            {preview}
          </DetailDrawer>,
          document.body,
        )}
    </>
  );
}

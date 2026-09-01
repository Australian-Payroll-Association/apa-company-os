"use client";

import { useRef, useState } from "react";

// Drag-and-drop wrapper around a plain file input — feeds the same hidden
// input a server-action <form> submits normally, via the standard
// DataTransfer trick (assigning input.files directly isn't possible, but
// swapping in a DataTransfer's FileList is). Visual pattern reused from
// GalleryManager's dropzone (.gallery-drop*) for consistency.
export function WorkbookDropzone({ name }: { name: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  function setFile(file: File | null) {
    if (!inputRef.current) return;
    const dt = new DataTransfer();
    if (file) dt.items.add(file);
    inputRef.current.files = dt.files;
    setFileName(file?.name ?? null);
  }

  return (
    <div
      className={`gallery-drop${drag ? " is-drag" : ""}`}
      role="button"
      tabIndex={0}
      onClick={() => inputRef.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        setFile(e.dataTransfer.files?.[0] ?? null);
      }}
    >
      <span className="gallery-drop-ico" aria-hidden>
        {fileName ? "📄" : "⬆"}
      </span>
      <span className="gallery-drop-title">{fileName ?? "Drag the workbook here, or click to browse"}</span>
      <span className="gallery-drop-sub">{fileName ? "Click to choose a different file" : ".xlsx only"}</span>
      <input
        ref={inputRef}
        type="file"
        name={name}
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        hidden
        onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
      />
    </div>
  );
}

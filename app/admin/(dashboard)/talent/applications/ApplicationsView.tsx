"use client";

import { useEffect, useState } from "react";
import type { KanbanColumn } from "@/components/admin/KanbanBoard";
import { ApplicationsTable, type AppRow } from "./ApplicationsTable";
import { ApplicationsBoard, type StageMap } from "./ApplicationsBoard";

const VIEW_KEY = "edge8-admin-applications-view";

// List/board switcher. Renders list on the server pass and swaps to the
// remembered view after mount — reading localStorage in the initial render
// would mismatch hydration.
export function ApplicationsView({
  rows,
  stageColumns,
  stageMap,
}: {
  rows: AppRow[];
  stageColumns: KanbanColumn[];
  stageMap: StageMap;
}) {
  const [view, setView] = useState<"list" | "board">("list");

  useEffect(() => {
    if (localStorage.getItem(VIEW_KEY) === "board") setView("board");
  }, []);

  function pick(v: "list" | "board") {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  }

  return (
    <>
      <div className="admin-toolbar" style={{ gap: 6, marginBottom: 4 }}>
        <button
          type="button"
          className={`admin-btn admin-btn--sm${view === "list" ? " admin-btn--primary" : ""}`}
          onClick={() => pick("list")}
          aria-pressed={view === "list"}
        >
          List
        </button>
        <button
          type="button"
          className={`admin-btn admin-btn--sm${view === "board" ? " admin-btn--primary" : ""}`}
          onClick={() => pick("board")}
          aria-pressed={view === "board"}
        >
          Board
        </button>
      </div>
      {view === "list" ? (
        <ApplicationsTable rows={rows} />
      ) : (
        <ApplicationsBoard rows={rows} columns={stageColumns} stageMap={stageMap} />
      )}
    </>
  );
}

"use client";

import { useState } from "react";
import { ViewToggle } from "@/components/admin/ViewToggle";
import { DetailDrawer } from "@/components/admin/DetailDrawer";
import {
  CHANNEL_LABEL,
  type BrandOption,
  type CalendarEntryRow,
} from "@/lib/admin/marketing-calendar";
import { NewEntryForm } from "./NewEntryForm";
import { CalendarBoard } from "./CalendarBoard";
import { CalendarMonth } from "./CalendarMonth";
import { EntryDrawer } from "./EntryDrawer";
import { moveEntry } from "./actions";

export function CalendarClient({
  initialEntries,
  brands,
}: {
  initialEntries: CalendarEntryRow[];
  brands: BrandOption[];
}) {
  const [entries, setEntries] = useState<CalendarEntryRow[]>(initialEntries);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = entries.find((e) => e.id === selectedId) ?? null;

  function move(id: string, status: string) {
    const prev = entries;
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, status: status as CalendarEntryRow["status"] } : e)));
    setBanner(null);
    moveEntry(id, status).then((r) => {
      if (!r.ok) {
        setEntries(prev);
        setBanner({ ok: false, text: `Couldn't move: ${r.error}` });
      }
    });
  }

  function patch(id: string, partial: Partial<CalendarEntryRow>) {
    setEntries((es) => es.map((e) => (e.id === id ? { ...e, ...partial } : e)));
  }

  function remove(id: string) {
    setEntries((es) => es.filter((e) => e.id !== id));
    setSelectedId(null);
  }

  function linkCampaign(id: string, campaignId: string) {
    patch(id, { campaignId, campaignStatus: "draft" });
  }

  function add(entry: CalendarEntryRow) {
    setEntries((es) => [...es, entry]);
  }

  function replaceAll(next: CalendarEntryRow[]) {
    setEntries(next);
  }

  return (
    <>
      {banner && (
        <div className={`admin-alert ${banner.ok ? "admin-alert--ok" : "admin-alert--err"}`} style={{ marginBottom: 12 }}>
          {banner.text}
        </div>
      )}

      <section className="admin-card admin-section-card">
        <div className="admin-card-title">New entry</div>
        <NewEntryForm brands={brands} onCreated={add} />
      </section>

      <ViewToggle
        views={[
          {
            key: "board",
            label: "Board",
            content: <CalendarBoard entries={entries} onMove={move} onCardClick={setSelectedId} />,
          },
          {
            key: "calendar",
            label: "Calendar",
            content: (
              <div className="admin-card admin-section-card">
                <h2 className="admin-card-title">Publish calendar</h2>
                <CalendarMonth entries={entries} onSelect={setSelectedId} />
              </div>
            ),
          },
        ]}
      />

      <DetailDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        eyebrow={selected ? CHANNEL_LABEL[selected.channel] : ""}
        title={selected?.title ?? "Entry"}
      >
        {selected && (
          <EntryDrawer
            entry={selected}
            brands={brands}
            allEntries={entries}
            onPatched={patch}
            onDeleted={remove}
            onLinkedCampaign={linkCampaign}
            onRepurposed={replaceAll}
          />
        )}
      </DetailDrawer>
    </>
  );
}

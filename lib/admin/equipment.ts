import { companyOs } from "@/lib/supabase";
import {
  ASSIGNMENT_SELECT,
  type AssignmentRow,
} from "@/app/admin/(dashboard)/operations/equipment/equipment-shared";

// Read helpers for the equipment register. Writes go through the server
// actions in the module (and, for custody changes, the assign_equipment /
// return_equipment RPCs, which are atomic).

export type PersonOption = { id: string; full_name: string };
export type VendorOption = { id: string; name: string };

// Custody history for one item, newest period first. The row with
// returned_at null is the current holder.
export async function listAssignments(equipmentId: string): Promise<AssignmentRow[]> {
  const { data } = await companyOs
    .from("equipment_assignments")
    .select(ASSIGNMENT_SELECT)
    .eq("equipment_id", equipmentId)
    .order("assigned_at", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as unknown as AssignmentRow[];
}

// Everything a given person currently holds. Powers the "before they leave"
// check and, later, the /team self-serve view.
export async function listOpenAssignmentsForPerson(personId: string) {
  const { data } = await companyOs
    .from("equipment_assignments")
    .select("id, assigned_at, equipment:equipment!equipment_assignments_equipment_id_fkey(id, asset_tag, name, type)")
    .eq("person_id", personId)
    .is("returned_at", null)
    .order("assigned_at", { ascending: false });
  return data ?? [];
}

// Assignable people: the internal team (persona=employee). Leavers who still
// hold something stay selectable via `include`, so a historical handover can
// always be recorded against the person who actually had it.
export async function listAssignablePeople(include?: (string | null)[]): Promise<PersonOption[]> {
  const { data } = await companyOs
    .from("people")
    .select("id, full_name, persona, archived_at")
    .order("full_name", { ascending: true });

  const extra = new Set((include ?? []).filter(Boolean) as string[]);
  return (data ?? [])
    .filter(
      (p: { id: string; full_name: string | null; persona: string | null; archived_at: string | null }) =>
        p.full_name && ((p.persona === "employee" && !p.archived_at) || extra.has(p.id)),
    )
    .map((p: { id: string; full_name: string | null }) => ({ id: p.id, full_name: p.full_name as string }));
}

export async function listVendorOptions(): Promise<VendorOption[]> {
  const { data } = await companyOs
    .from("vendors")
    .select("id, name")
    .is("archived_at", null)
    .order("name", { ascending: true });
  return (data ?? []) as VendorOption[];
}

export type PendingRequest = {
  id: string;
  type: string;
  reason: string | null;
  needed_by: string | null;
  created_at: string;
  person: { id: string; full_name: string | null } | null;
};

// Open asks from /team. Surfaced on the equipment list so a request can't sit
// unseen in a table nobody opens.
export async function listPendingRequests(): Promise<PendingRequest[]> {
  const { data } = await companyOs
    .from("equipment_requests")
    .select(
      "id, type, reason, needed_by, created_at, " +
        "person:people!equipment_requests_person_id_fkey(id, full_name)",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []) as unknown as PendingRequest[];
}

// Counts for the list page subtitle: what is out, what is on the shelf, and
// what the register is worth.
export async function equipmentSummary(): Promise<{
  total: number;
  inUse: number;
  inStock: number;
  valueVnd: number;
}> {
  const { data } = await companyOs
    .from("equipment")
    .select("status, cost_vnd")
    .is("archived_at", null);

  const rows = (data ?? []) as { status: string; cost_vnd: number | null }[];
  return {
    total: rows.length,
    inUse: rows.filter((r) => r.status === "in_use").length,
    inStock: rows.filter((r) => r.status === "in_stock").length,
    valueVnd: rows.reduce((sum, r) => sum + Number(r.cost_vnd ?? 0), 0),
  };
}

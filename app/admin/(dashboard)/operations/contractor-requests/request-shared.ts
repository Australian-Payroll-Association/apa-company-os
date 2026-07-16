// Shared row type + select for the contractor work-requests list. The people
// embed uses an explicit FK hint (two FKs would break a bare embed at runtime).

export const REQUEST_SELECT =
  "id, person_id, title, brief, access_token, status, estimated_hours, plan_text, estimate_submitted_at, decided_by, decided_at, actual_hours, actual_overtime_hours, work_summary, work_link, work_submitted_at, accepted_by, accepted_at, payment_id, created_by, created_at, people!person_id(full_name, email)";

export type RequestRow = {
  id: string;
  person_id: string;
  title: string;
  brief: string;
  access_token: string;
  status: string;
  estimated_hours: number | string | null;
  plan_text: string | null;
  estimate_submitted_at: string | null;
  decided_by: string | null;
  decided_at: string | null;
  actual_hours: number | string | null;
  actual_overtime_hours: number | string | null;
  work_summary: string | null;
  work_link: string | null;
  work_submitted_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  payment_id: string | null;
  created_by: string;
  created_at: string;
  people:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
};

export type RequestEventRow = {
  id: string;
  actor_type: string;
  actor: string | null;
  type: string;
  body: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export const onePerson = (
  e: RequestRow["people"],
): { full_name: string | null; email: string } | null => (Array.isArray(e) ? e[0] ?? null : e);

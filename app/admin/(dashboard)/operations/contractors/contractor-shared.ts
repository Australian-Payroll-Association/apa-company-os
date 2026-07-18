// Shared types for the contractors roster. The roster is not its own table:
// a contractor = team_members.employment_type = 'contract' joined to people,
// with rates in company_os.compensation (comp_type 'hourly' / 'overtime').

export type ContractorRow = {
  id: string; // = team_member_id (DataTable keys on id)
  team_member_id: string;
  person_id: string;
  full_name: string | null;
  email: string;
  status: string;
  start_date: string | null;
  department: string | null;
  position: string | null;
  hourly_rate_cents: number | null;
  overtime_rate_cents: number | null;
  currency: string;
};

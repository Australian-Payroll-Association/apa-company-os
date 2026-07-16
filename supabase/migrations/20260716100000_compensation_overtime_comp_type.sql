-- Applied 2026-07-16 via Supabase MCP migration `compensation_overtime_comp_type`
-- Allow an 'overtime' comp_type so contractor overtime rates can live in compensation.
-- Additive only: keeps every existing value and appends 'overtime'.
alter table company_os.compensation drop constraint compensation_comp_type_check;
alter table company_os.compensation add constraint compensation_comp_type_check
  check (comp_type in ('base_salary','hourly','bonus','commission','equity','stipend','allowance','overtime'));

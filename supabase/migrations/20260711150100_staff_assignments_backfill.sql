-- Applied 2026-07-11 via Supabase MCP migration `staff_assignments_backfill`.
-- Backfill confirmed by Dave 2026-07-11 (docs/plans/2026-07-11-client-portal-design.md).
-- Every id below was verified against the live DB (departments + explicit overrides
-- for Loi Nguyen and Quang Van, who had no department set).
insert into company_os.staff_assignments (company_id, team_member_id)
values
  -- Entrepreneurs Organization (EO)
  ('7be4752c-c39b-4edc-9b1b-8cf61c4ff867', 'c2b4902e-68f8-4cd3-ba0e-9c6a1127606c'), -- Ha Nguyen
  ('7be4752c-c39b-4edc-9b1b-8cf61c4ff867', '02c0ed1e-7ac9-4e0e-aa55-b97c033748aa'), -- Lê Tấn Khôi
  ('7be4752c-c39b-4edc-9b1b-8cf61c4ff867', '4e8f72bf-9245-43ab-b2cf-11b3bc2727d3'), -- Nguyễn Hữu Thành
  ('7be4752c-c39b-4edc-9b1b-8cf61c4ff867', 'fff9f8e8-138b-4d90-a567-dd73cd3c2858'), -- Quang Van
  -- On Target by Abound Health
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'd929338d-1e70-43ac-a5ec-06f28eb26817'), -- Lê Minh Tân
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'b38d7bf2-643b-4d11-8ecc-af3b25b8f2ca'), -- Lê Vinh
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', '3157075d-b72f-4778-9894-ae3702cf483b'), -- Loi Nguyen
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'fe5341ba-185a-4225-b937-c49ef69b109d'), -- Nguyễn Minh Tâm
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', '8d06e46e-f4ea-4879-b2f7-2f168c0be03b'), -- Nguyễn Văn Đức
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', '5c7e1178-47fb-4ead-9fd0-3ba32ba557a3'), -- Trần Nhật Thanh
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'daaa4932-61c5-47c7-becb-584577522fab'), -- Trần Thanh Bình
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'b66551f1-eb87-4a16-a6c2-e20f5bb23d74'), -- Vũ Trần Minh
  -- Unlock Venture Partners
  ('6268b2b7-07eb-4c77-9721-b4cd5ba30d55', '06820661-3864-48ca-b68e-533f9a86d4f5'), -- Nguyễn Chí Hiếu
  -- Wareease
  ('1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24', '3408854a-2322-47fc-9184-d1600289072f')  -- Lê Minh Quân
on conflict do nothing;

-- Set the missing department_id for the two people who had none, so the org
-- data and the new assignments agree (per the plan's Slice 2 cleanup note).
update company_os.team_members
   set department_id = (select id from company_os.departments where name = 'OnTarget')
 where id = '3157075d-b72f-4778-9894-ae3702cf483b' and department_id is null; -- Loi Nguyen

update company_os.team_members
   set department_id = (select id from company_os.departments where name = 'EO')
 where id = 'fff9f8e8-138b-4d90-a567-dd73cd3c2858' and department_id is null; -- Quang Van

insert into company_os.audit_log (actor_label, table_name, operation, new_data, context)
values ('client-portal-pr2', 'staff_assignments', 'insert',
  '{"count": 14}', '{"action": "backfill", "clients": ["EO","On Target","Unlock","Wareease"]}');

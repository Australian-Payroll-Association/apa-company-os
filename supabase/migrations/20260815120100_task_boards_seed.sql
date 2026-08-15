-- Seed the seven starting boards, their columns (To do / Doing / Waiting / Done),
-- client links, and memberships. Idempotent. Person/company UUIDs were resolved
-- against the live company_os CRM before writing (names in comments for audit).
-- Applied out-of-band via Supabase MCP.

insert into company_os.boards (name, slug, client_company_id, owner_id, sort_order) values
 ('AIOlabz','aiolabz',null,'a8bf026f-8c20-49c5-8a55-6fc5c580af64',0),                                              -- owner: Dave Hajdu
 ('Operations','operations',null,'a8bf026f-8c20-49c5-8a55-6fc5c580af64',1),
 ('Eight Edges','eight-edges',null,'a8bf026f-8c20-49c5-8a55-6fc5c580af64',2),
 ('Australian Payroll','australian-payroll','1750a8ca-93ea-4369-aca1-c55553a49073','a8bf026f-8c20-49c5-8a55-6fc5c580af64',3), -- client: Australian Payroll Association
 ('Work Healthy','work-healthy','1787dc4b-a9f5-409d-a81b-e2cfdf75f95d','a8bf026f-8c20-49c5-8a55-6fc5c580af64',4),  -- client: Work Healthy Australia
 ('Arca Wellness','arca-wellness','6dbb0ebf-ed3c-42c5-b3d8-a91e219cc432','a8bf026f-8c20-49c5-8a55-6fc5c580af64',5), -- client: Arca Wellness
 ('EO Global','eo-global',null,'a8bf026f-8c20-49c5-8a55-6fc5c580af64',6)
on conflict (slug) do update set
  name=excluded.name, client_company_id=excluded.client_company_id,
  owner_id=excluded.owner_id, sort_order=excluded.sort_order;

insert into company_os.board_columns (board_id, name, position, is_done)
select b.id, c.name, c.position, c.is_done
from company_os.boards b
cross join (values ('To do',0,false),('Doing',1,false),('Waiting',2,false),('Done',3,true)) as c(name,position,is_done)
where b.slug in ('aiolabz','operations','eight-edges','australian-payroll','work-healthy','arca-wellness','eo-global')
and not exists (select 1 from company_os.board_columns bc where bc.board_id=b.id and bc.name=c.name);

insert into company_os.board_members (board_id, person_id, role)
select b.id, m.person_id::uuid,
  case when m.person_id='a8bf026f-8c20-49c5-8a55-6fc5c580af64' then 'owner' else 'member' end
from (values
 ('aiolabz','6084bd5d-0ab8-4e22-9bf9-c5642056c1f9'),   -- Khoa Doan
 ('aiolabz','b5d13ca3-084b-4a53-a9c7-6aaea7a9a35e'),   -- Ethan Truong
 ('aiolabz','2ce48626-654c-4d6f-b2b4-3d65bfe2768f'),   -- Quan Chau
 ('aiolabz','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),   -- Dave Hajdu
 ('aiolabz','c3b24e75-f382-4c0e-9e83-2fb88743ffed'),   -- Viha Nghiem
 ('aiolabz','4249892d-d410-43ed-aad7-4b0020c45f21'),   -- Quang Van
 ('aiolabz','2d307ea5-7a7e-4ad8-b53b-b41e6493b4fe'),   -- Ash Ly
 ('operations','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),-- Dave
 ('operations','794dff91-c66e-4a87-a13e-b9f966c9878b'),-- My Pham
 ('operations','ca16bf0c-5cbe-4afa-a48a-afc97d7191f4'),-- Mai Dang
 ('eight-edges','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),-- Dave
 ('eight-edges','2d307ea5-7a7e-4ad8-b53b-b41e6493b4fe'),-- Ash Ly
 ('eight-edges','c3b24e75-f382-4c0e-9e83-2fb88743ffed'),-- Viha Nghiem
 ('australian-payroll','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),-- Dave
 ('australian-payroll','6084bd5d-0ab8-4e22-9bf9-c5642056c1f9'),-- Khoa Doan
 ('work-healthy','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),-- Dave
 ('work-healthy','2ce48626-654c-4d6f-b2b4-3d65bfe2768f'),-- Quan Chau
 ('arca-wellness','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),-- Dave
 ('arca-wellness','2ce48626-654c-4d6f-b2b4-3d65bfe2768f'),-- Quan Chau
 ('arca-wellness','2d307ea5-7a7e-4ad8-b53b-b41e6493b4fe'),-- Ash Ly
 ('eo-global','a8bf026f-8c20-49c5-8a55-6fc5c580af64'),  -- Dave
 ('eo-global','5c7e1178-47fb-4ead-9fd0-3ba32ba557a3'),  -- Thanh Tran (assumption: "Thanh" = Tran Nhat Thanh)
 ('eo-global','02c0ed1e-7ac9-4e0e-aa55-b97c033748aa'),  -- Khoi Le
 ('eo-global','822f9d57-ccc2-49fc-860c-35e53ed53b56')   -- Ha Nguyen
) as m(slug, person_id)
join company_os.boards b on b.slug=m.slug
on conflict (board_id, person_id) do nothing;

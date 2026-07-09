-- Backfill: fill industry + industry_normalized for companies that had no
-- industry at all, based on the 2026-07-09 web research done for size bands.
-- Skipped as unidentifiable: Eric Enriquez (individual), Five Rock, Genesis,
-- The Problem Solver. Guarded on industry is null so manual entries and
-- re-runs are safe.
-- Run via Supabase MCP execute_sql against project wwchefrgkkxmhlkntufm.

update company_os.companies c
set industry = m.industry,
    industry_normalized = m.category,
    updated_at = now()
from (values
  ('dc4cc5c8-8501-4815-a98a-3fea22964a72', 'Educational Products',           'Education'),                   -- Aim up Vietnam
  ('3f021866-fab4-4465-b11d-31f10ec311e2', 'Renewable Energy Financing',     'Energy'),                      -- Aquila
  ('57dc8430-0dbe-43f8-a667-4a5a553a48f2', 'Eco Tourism',                    'Hospitality & Travel'),        -- Borneo Eco Tours
  ('47ea790d-ec5f-4c6c-8352-6457456d0132', 'Footwear Retail',                'Retail & Consumer Goods'),     -- Bstore
  ('d6f5a6c5-8890-41a7-853d-25c7c8e27153', 'Events Management',              'Marketing & Media'),           -- Compass Events
  ('0c53040c-b73d-426c-b16e-c743cfd39990', 'Industrial Automation',          'Technology & Software'),       -- Cygnus
  ('8bdd0566-ed10-4c12-82c9-90fd8591b891', 'Outsourcing / BPO',              'Professional Services'),       -- Doxa Talent
  ('7be4752c-c39b-4edc-9b1b-8cf61c4ff867', 'Business Network',               'Professional Services'),       -- Entrepreneurs Organization
  ('e282e8b8-d135-4f56-9564-2a3d9b7e890b', 'Leadership Advisory',            'Professional Services'),       -- Evolution Partners
  ('2f07b428-be7b-44f5-b107-74cc989faf42', 'Leadership Training & Speaking', 'Professional Services'),       -- Fab Four Academy
  ('957d51d6-0e64-4118-bd40-7ff0deb58012', 'Textile Manufacturing',          'Manufacturing'),               -- Kyungbang Vietnam
  ('bb7a719f-ec0e-4e4e-93f1-c3250a1edb10', 'Leadership Development',         'Education'),                   -- Leaderonomics
  ('337499c6-481e-4874-9fcf-0d7e7f6419d0', 'Modular Construction',           'Real Estate & Construction'),  -- Lima Tango
  ('95a4bdc8-67b2-4339-9da6-699fecd6a720', 'Language Education',             'Education'),                   -- Ni Hao Ma
  ('527fdd2a-4b4c-4db3-94c8-7fbb2a1a85cc', 'Fresh Flower Wholesale',         'Retail & Consumer Goods'),     -- Profresh
  ('1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24', 'Produce Wholesale',              'Food & Beverage'),             -- Qualicious
  ('3fe229ed-c20e-46da-a64d-5c0c2f08d594', 'Trade Association',              'Professional Services'),       -- SME Sabah
  ('024b5ca2-e7aa-4a98-9c6d-4228efb1ead5', 'Kids Bedding (DTC)',             'Retail & Consumer Goods'),     -- Teddy Bed
  ('b8b21ec2-6db4-44dd-9516-ad9ee3699f5f', 'Business Coaching',              'Professional Services'),       -- The Icarus Institute
  ('6b05401c-f750-4f84-b554-47c6c78ed2a3', 'Recruitment',                    'Professional Services'),       -- Titan Recruitment
  ('5859ea70-ea2a-4785-bb7a-3ff7eb31d1ee', 'Travel & Tours',                 'Hospitality & Travel'),        -- Travel Buddy
  ('c2fb8d92-48f5-4879-9503-5e8a8511141b', 'Digital Marketing Services',     'Marketing & Media'),           -- Trinity42 Digital
  ('25de1217-7b23-440c-a085-25106b82af15', 'Supermarkets',                   'Retail & Consumer Goods'),     -- Tucker Fresh
  ('15d2d8d5-1e0d-4c64-8a0c-a24e508ba2e3', 'Real Estate Consultancy',        'Real Estate & Construction'),  -- Viettrust Group
  ('f6696181-3ac5-40a0-a210-4625bf2c4aca', 'Property Funds Management',      'Financial Services'),          -- Westbridge Funds
  ('c1f83b99-a8f2-4cd9-86b2-7016a79e7408', 'Web Platform (SaaS)',            'Technology & Software')        -- Wix
) as m(id, industry, category)
where c.id = m.id::uuid
  and (c.industry is null or c.industry = '');

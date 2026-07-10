-- Backfill: country for companies that had none, from ccTLD domains + the
-- 2026-07-09 web research. Only high-confidence assignments; genuinely
-- ambiguous / global / unidentifiable companies stay null (render as
-- "Unknown"). Guarded on country is null: idempotent, never overwrites.
-- Run via Supabase MCP execute_sql against project wwchefrgkkxmhlkntufm.

update company_os.companies c
set country = m.country,
    updated_at = now()
from (values
  -- Vietnam (.vn ccTLD, "Vietnam"/"Saigon"/"HCMC" in name, or research location)
  ('a4a0e601-94b3-46fa-817c-2622c762dc5a', 'Vietnam'),        -- 5 Elements Brewery
  ('87da729b-25cc-4b63-aac2-a2bb35522909', 'Vietnam'),        -- AFG Vietnam
  ('dc4cc5c8-8501-4815-a98a-3fea22964a72', 'Vietnam'),        -- Aim up Vietnam
  ('73a2180e-792b-40d7-9ee7-e7f34462c426', 'Vietnam'),        -- Alchemy (HCMC)
  ('92f68da1-590b-499f-9060-917e0d0a379c', 'Vietnam'),        -- Baba's Kitchen (HCMC)
  ('3508c436-afcc-4e64-93b5-fecf8a4bfc72', 'Vietnam'),        -- Betrimex
  ('036825fd-eb7b-4a3a-9da6-7e86bf8ebc2d', 'Vietnam'),        -- Codelink.io
  ('0c9c281c-4b7d-4e74-ba79-0efe0d269caa', 'Vietnam'),        -- Dao Nguyen Legal
  ('b5b6d7fc-aa44-426b-a147-2cb8ddbfabf8', 'Vietnam'),        -- East West Brewing
  ('61c1c7dc-3260-4a11-a381-9c65f4714903', 'Vietnam'),        -- Eddie's Diner
  ('6014551c-4868-40be-9bf5-5432d7e82ef1', 'Vietnam'),        -- Edge8
  ('cee76415-a77d-465f-b126-dbc7c42a13bc', 'Vietnam'),        -- Esco Beach (Da Nang)
  ('9ee33d9c-b042-4da0-afd0-6efbe44f1db2', 'Vietnam'),        -- Esco Beach Bar Lounge
  ('d19bc683-823f-401c-bb25-881086c556dd', 'Vietnam'),        -- Frasers Law
  ('d34eb0c2-565c-4697-b6f2-b256a36b04e2', 'Vietnam'),        -- Gam Entertainment
  ('c33dd588-b73f-4e67-8d76-00659580a5cd', 'Vietnam'),        -- Hassan Vietnam
  ('4038acba-63f4-417a-beb4-a34880f94b34', 'Vietnam'),        -- House of Barbaard
  ('05b15f3b-43a4-4f9c-b7ba-30cd291a0dba', 'Vietnam'),        -- Ipa-Nima Vietnam
  ('c6c5f6c1-7349-4dc7-83c7-0925b67f273e', 'Vietnam'),        -- IPPG Vietnam
  ('fa61385d-476a-413e-94a3-abb509cb85e2', 'Vietnam'),        -- KOTO (Hanoi social enterprise)
  ('5a750931-9599-4788-9848-5017fd385032', 'Vietnam'),        -- Kusto Home
  ('957d51d6-0e64-4118-bd40-7ff0deb58012', 'Vietnam'),        -- Kyungbang Vietnam (VN plant)
  ('337499c6-481e-4874-9fcf-0d7e7f6419d0', 'Vietnam'),        -- Lima Tango (VN registry)
  ('4d493ed3-e78d-4c37-84e1-a433f7c30a17', 'Vietnam'),        -- Mueller Group (VN agency)
  ('95a4bdc8-67b2-4339-9da6-699fecd6a720', 'Vietnam'),        -- Ni Hao Ma (HCMC)
  ('b3993a6d-190c-4bd7-a30e-a5fc83fa17de', 'Vietnam'),        -- Pho 24
  ('9e96da7e-0c23-48bc-b5b6-0b125938c127', 'Vietnam'),        -- Shopee Vietnam
  ('003f80fa-edff-4c00-aa0f-4ab5aba14e83', 'Vietnam'),        -- Sol Kitchen & Bar (HCMC)
  ('d9af4449-36b7-4c7b-a7bf-e3c36be5a218', 'Vietnam'),        -- Tartine Saigon
  ('d4d53abd-1dce-46a5-99c9-dee3a1f89c95', 'Vietnam'),        -- Tenzing Pacific (VN broker)
  ('eb5640d1-79b0-4e3d-8d77-6fd853debe09', 'Vietnam'),        -- Vespa Adventures
  ('f75e1798-f0c1-4807-a558-b8279e1842a0', 'Vietnam'),        -- Vespa Adventures (dup)
  ('9fac9f50-9873-4605-95d7-087b2301c33f', 'Vietnam'),        -- Vietrose International
  ('15d2d8d5-1e0d-4c64-8a0c-a24e508ba2e3', 'Vietnam'),        -- Viettrust Group (HCMC)
  ('2322ba51-db54-40cf-a828-05819cc995a0', 'Vietnam'),        -- Vulcan Labs (HCMC)
  ('e962f49d-d8f1-43fa-9e44-a12a2e438421', 'Vietnam'),        -- Westcoast Dental (HCMC+Hanoi)
  ('0968eaea-35f7-46d6-ac48-70f10fa5e763', 'Vietnam'),        -- Wink Hotel Group
  ('18e195ed-6d80-4c12-99bc-37a473862dad', 'Vietnam'),        -- World Steel Group (HCMC)
  ('6cbde81c-efb5-43fb-b782-677497c96fdc', 'Vietnam'),        -- Wyndham Danang Golden Bay
  -- United States (research HQ location)
  ('e41b68e0-c523-4fda-9a0e-83783ed8323c', 'United States'),  -- Absher Construction (WA)
  ('d8ca021f-885f-414b-85dc-d534b5230e20', 'United States'),  -- AEGIS Insurance
  ('84674da4-21db-4443-a960-aa7bcd56752a', 'United States'),  -- Aegis Insurance Broker
  ('e7454f66-6cf2-4933-8bb1-01d60af8d7e1', 'United States'),  -- Brooks AI
  ('b098c324-adaf-4d5c-bb9c-3fe10c83bd40', 'United States'),  -- Delight Labs PR (Seattle)
  ('2f07b428-be7b-44f5-b107-74cc989faf42', 'United States'),  -- Fab Four Academy
  ('3b6ce74b-0dcf-48b6-8478-9406e774fc90', 'United States'),  -- Field & Forest (MS)
  ('a3ac94f9-6294-4456-8c1c-8bbeb3eaa38a', 'United States'),  -- Gravis Law
  ('f4f267bb-7e47-4cec-8e1b-e4ebc780fe7a', 'United States'),  -- Hermes Landscaping (KS)
  ('48e7888e-e0c7-4572-b17e-c1037f636d45', 'United States'),  -- Hit Lights LED (LA)
  ('7317eac9-5aeb-44ff-a5d8-62b0145e1ca1', 'United States'),  -- Multifunding
  ('ec0f7dd3-45a9-4b88-bd05-1d0e9ebd5b42', 'United States'),  -- On Target / Abound Health
  ('d0b40204-35e0-4e5d-8710-e0737d3f8e6e', 'United States'),  -- Oseran Hahn (WA)
  ('23473632-2ca3-4b55-b08c-09696b91f483', 'United States'),  -- Poseidon (Seattle)
  ('9ca995d3-2984-414e-b46a-a667d1bc96d8', 'United States'),  -- Useposeidon (Seattle)
  ('ad4d1ace-aa3e-4338-98af-880f684474b1', 'United States'),  -- Single Grain (LA)
  ('3675fec3-2ce5-4e9d-8cf2-47722eb2c684', 'United States'),  -- Socket / SkyeFox
  ('87d0c5ba-54c4-4b9e-8411-3bed518269b6', 'United States'),  -- Surrogate First (LA)
  ('6268b2b7-07eb-4c77-9721-b4cd5ba30d55', 'United States'),  -- Unlock Venture Partners
  ('d9f2cffa-50a0-4b84-b106-d9e757bbf222', 'United States'),  -- Vee International (NY)
  ('34777b3d-d06f-42c2-91ce-0d9775e2bc32', 'United States'),  -- Veracity (IT)
  ('68078e96-2654-4155-94d6-02743b70190d', 'United States'),  -- TinyPulse (Seattle)
  ('1093fbc0-7d47-4c2c-8f4b-4c55f71b5b24', 'United States'),  -- Qualicious (Seattle/LA)
  ('85f7dfb2-1f8c-449b-97a8-be25ea33f06d', 'United States'),  -- Tikis (Waikiki, Hawaii)
  -- Malaysia (.my ccTLD, "Sdn Bhd", or research location)
  ('57dc8430-0dbe-43f8-a667-4a5a553a48f2', 'Malaysia'),       -- Borneo Eco Tours (Sabah)
  ('0c53040c-b73d-426c-b16e-c743cfd39990', 'Malaysia'),       -- Cygnus
  ('1bc58e46-5a3a-4702-bfcb-196c4fe5a0e3', 'Malaysia'),       -- eCube
  ('b46bf464-f91c-41bb-883d-8bee1cb5eaf8', 'Malaysia'),       -- Fairview International School
  ('3fe229ed-c20e-46da-a64d-5c0c2f08d594', 'Malaysia'),       -- SME Sabah
  ('c2fb8d92-48f5-4879-9503-5e8a8511141b', 'Malaysia'),       -- Trinity42 Digital (Sdn Bhd)
  ('bb7a719f-ec0e-4e4e-93f1-c3250a1edb10', 'Malaysia'),       -- Leaderonomics
  ('c91eeb7d-6765-4b9f-9aff-bf945a024765', 'Malaysia'),       -- MomentsWare (Johor)
  ('44924812-9094-4c82-8604-fc3b26d01ad0', 'Malaysia'),       -- Sound Acoustic (Sdn Bhd)
  -- Singapore
  ('c4e817e3-b008-4abd-ba2e-7cc38981413b', 'Singapore'),      -- Accel Scaling
  ('d6f5a6c5-8890-41a7-853d-25c7c8e27153', 'Singapore'),      -- Compass Events (Pte Ltd)
  ('7dcaae52-1cf3-49b7-b552-f6579551fac1', 'Singapore'),      -- FoodXervices
  -- Hong Kong
  ('f544bda1-b560-46c8-bed3-b56171565fa8', 'Hong Kong'),      -- CASH Financial Services Group
  ('900e69b6-79d1-4e90-99be-3f9139f147b8', 'Hong Kong'),      -- Ikaria Group
  ('c68b09a8-da3c-448d-8812-b1a1d6bb63ff', 'Hong Kong'),      -- TAL Apparel
  -- Australia (research location; .com.au ones already set)
  ('1750a8ca-93ea-4369-aca1-c55553a49073', 'Australia'),      -- AustPayroll
  ('b6467be0-601d-4a79-8bcf-c6f60c15e9f9', 'Australia'),      -- Meet Aandi (Brisbane)
  ('5194fe00-0eba-49c1-a063-9688ad205b1d', 'Australia'),      -- Visa Solutions
  ('1787dc4b-a9f5-409d-a81b-e2cfdf75f95d', 'Australia'),      -- Work Healthy Australia
  -- New Zealand
  ('73b4d11a-4126-495b-b700-886219c7c88e', 'New Zealand'),    -- Cadenza
  -- Philippines
  ('1f9fd302-1e30-4361-8397-6dcfb8db79bc', 'Philippines')     -- Toyota Philippines (CAB Group)
) as m(id, country)
where c.id = m.id::uuid
  and (c.country is null or c.country = '');

-- Left null (ambiguous / global / unidentifiable): AI-Assisted Coaching,
-- Aquila, Aron Photography, Asia Film Fixers, Avison Young, Caram Gems, CGM,
-- Chikita, Common Metal, Design X, DFDL, Digital Trends Media, Doxa Talent,
-- Entrepreneurs Organization, Eric Enriquez, Five Rock, Genesis, Grady Golf,
-- Grit Volleyball, IFP Partners, Invest Migrate, Kation, Power of 3, Revolve
-- Bioplastics, Rockhill Asia, Studio3eight, The Icarus Institute, The Problem
-- Solver, VISTAGE, Wix Live Support, YPO Gold Forum.

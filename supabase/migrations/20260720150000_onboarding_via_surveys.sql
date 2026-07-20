-- New Member Onboarding, built ON the existing survey engine (not a new form).
-- Additive only — the surveys/* tables have an external writer and real data.
--
-- What this adds:
--   1. surveys.purpose            — nullable tag; 'onboarding' triggers the CRM processor
--   2. people.lark_email          — company @edge8.ai email, recorded post-hire
--   3. people.graduated_from      — non-sensitive education field
--   4. people_sensitive.place_of_birth / native_province — two missing PII columns
--   5. team_members.employment_stage CHECK — onboarding + off-ramp vocabulary
--   6. Seed the "new-member-onboarding" survey + its fields, each field carrying
--      a config.maps_to that says where its answer lands in the CRM.
--
-- New field types (date, file) are enforced in TS (lib/admin/surveys.ts), matching
-- the existing convention that survey field types are app-enforced, not DB CHECKs,
-- so no type-enum migration is needed. File answers store the object path in the
-- private `id-documents` bucket, which already exists.

-- 1) surveys.purpose ---------------------------------------------------------
alter table company_os.surveys add column if not exists purpose text;

-- 2/3) people additive columns ----------------------------------------------
alter table company_os.people
  add column if not exists lark_email citext,
  add column if not exists graduated_from text;

-- 4) people_sensitive additive PII columns (restricted store, service-role only)
alter table company_os.people_sensitive
  add column if not exists place_of_birth text,
  add column if not exists native_province text;

-- 5) team_members onboarding + off-ramp stage vocabulary --------------------
-- Existing values are 'probation' or null (both allowed here), so this is
-- compatible with current rows. null = confirmed/regular, as today.
alter table company_os.team_members
  drop constraint if exists team_members_employment_stage_check;
alter table company_os.team_members
  add constraint team_members_employment_stage_check
  check (employment_stage is null or employment_stage in
    ('pre_boarding','probation','full_time','declined_offer','rescinded','failed_probation'));

-- 5b) Default private bucket for admin-created `file` fields whose config does
-- not name a bucket. Onboarding uses the existing `id-documents` bucket; this is
-- the fallback so the file field type works generally. Private, 10 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'survey-uploads', 'survey-uploads', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do nothing;

-- 6) Seed the onboarding survey ---------------------------------------------
-- Fixed id so the field seed is deterministic and idempotent.
insert into company_os.surveys (id, slug, name, description, status, is_anonymous, purpose, intro_text, thank_you_text)
values (
  'e1b2c3d4-0000-4000-8000-000000000001',
  'new-member-onboarding',
  'New Member Onboarding',
  'Welcome to Edge8. A few details to get you set up.',
  'published',
  false,
  'onboarding',
  'Welcome to the team! This takes about 5 minutes. Have your ID card and bank details handy. Everything you share here is stored securely and used only for your employment setup.',
  'All set — thank you! Your details are in. We''ll send an invite to the team portal at the email you gave us, and your manager will be in touch about your start date.'
)
on conflict (id) do nothing;

-- Fields: each answer maps to a CRM column via config.maps_to. Name + email are
-- collected by the survey's built-in identity step, so they are not fields here.
insert into company_os.survey_fields (survey_id, position, type, label, help_text, required, config)
select 'e1b2c3d4-0000-4000-8000-000000000001', v.position, v.type, v.label, v.help_text, v.required, v.config::jsonb
from (values
  (1,  'date',          'Date of birth',                    null,                                                        true,  '{"maps_to":"people_sensitive.date_of_birth"}'),
  (2,  'short_text',    'Place of birth',                   null,                                                        true,  '{"maps_to":"people_sensitive.place_of_birth"}'),
  (3,  'short_text',    'Position',                         'The role you are joining as',                               true,  '{"maps_to":"people.metadata.position"}'),
  (4,  'short_text',    'Phone number',                     null,                                                        true,  '{"maps_to":"people.phone"}'),
  (5,  'long_text',     'Permanent address (as on ID card)', null,                                                       true,  '{"maps_to":"people_sensitive.permanent_address"}'),
  (6,  'long_text',     'Current address',                  null,                                                        true,  '{"maps_to":"people_sensitive.current_address"}'),
  (7,  'short_text',    'ID card number',                   'Digits only — keep any leading zeros',                      true,  '{"maps_to":"people_sensitive.national_id_number"}'),
  (8,  'short_text',    'Place of issue (ID card)',         null,                                                        true,  '{"maps_to":"people_sensitive.national_id_issue_place"}'),
  (9,  'short_text',    'Native province (as on ID card)',  null,                                                        true,  '{"maps_to":"people_sensitive.native_province"}'),
  (10, 'date',          'Date of issue (ID card)',          null,                                                        true,  '{"maps_to":"people_sensitive.national_id_issue_date"}'),
  (11, 'single_choice', 'Marital status',                   null,                                                        true,  '{"choices":["Single","Married"],"maps_to":"people_sensitive.marital_status"}'),
  (12, 'short_text',    'Graduated from',                   'Your school or university',                                 true,  '{"maps_to":"people.graduated_from"}'),
  (13, 'short_text',    'Emergency contact',                'Name and phone number',                                     true,  '{"maps_to":"people.emergency_contact_name"}'),
  (14, 'long_text',     'Bank account details',             'Account number - Bank name - Branch. e.g. 0012000000 - Eximbank - CN Tan Binh', true, '{"maps_to":"people_sensitive.bank_name"}'),
  (15, 'short_text',    'PIT code (personal income tax)',   'Leave blank if you do not have one yet',                    false, '{"maps_to":"people_sensitive.tax_code"}'),
  (16, 'short_text',    'Social insurance number',          'Leave blank if you do not have one yet',                    false, '{"maps_to":"people_sensitive.social_insurance_number"}'),
  (17, 'file',          'ID card — front',                  'Photo or scan · JPG, PNG, WebP or PDF, max 10 MB',          true,  '{"bucket":"id-documents","accept":["image/jpeg","image/png","image/webp","application/pdf"],"max_bytes":10485760,"maps_to":"people_sensitive.id_front_path"}'),
  (18, 'file',          'ID card — back',                   'Photo or scan · JPG, PNG, WebP or PDF, max 10 MB',          true,  '{"bucket":"id-documents","accept":["image/jpeg","image/png","image/webp","application/pdf"],"max_bytes":10485760,"maps_to":"people_sensitive.id_back_path"}'),
  (19, 'file',          'Selfie',                           'A clear photo of your face · JPG, PNG or WebP, max 10 MB',   true,  '{"bucket":"id-documents","accept":["image/jpeg","image/png","image/webp"],"max_bytes":10485760,"maps_to":"people_sensitive.id_selfie_path"}'),
  (20, 'multi_choice',  'Fun stuff — what are you into?',   'Pick any that apply',                                       false, '{"choices":["Coffee or tea","Foodie / new restaurants","Cooking & baking","Traveling","Photography","Reading","Gaming","Music & instruments","Karaoke / singing","Movies & series","Football (soccer)","Gym & fitness","Yoga & meditation","Hiking & outdoors","Cycling / running","Art & painting","Pets & animals","Board games & puzzles"],"maps_to":"people.metadata.fun_stuff.interests"}'),
  (21, 'long_text',     'Anything else? Tell us a fun fact about you.', null,                                             false, '{"maps_to":"people.metadata.fun_stuff.note"}')
) as v(position, type, label, help_text, required, config)
where not exists (
  select 1 from company_os.survey_fields where survey_id = 'e1b2c3d4-0000-4000-8000-000000000001'
);

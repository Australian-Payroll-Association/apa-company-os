-- Brand writing profiles: the voice, positioning, audience, offer, and content
-- rules a writer (human or the AI drafter) needs to produce on-lens copy for a
-- brand. One profile per brand.
--
-- Seeded from the content-studio context (edge8/context/channels-and-guidelines.md
-- and the AI Officer Institute certification positioning). content-studio stays
-- the authoring source; this table is the app's editable copy so the campaign
-- editor and the AI writer can read it at runtime (a deployed app cannot read
-- that local folder). Nothing about the output is hardwired in code: the writer
-- follows content_rules_md, which the admin can edit.
-- Applied via Supabase MCP.

create table if not exists company_os.brand_profiles (
  brand_id uuid primary key references company_os.brands(id) on delete cascade,
  positioning text,       -- what the brand is and what it sells, in a sentence or two
  audience text,          -- who we are writing to
  voice_md text,          -- tone and voice guidance (markdown)
  offer text,             -- the thing we are selling
  primary_cta text,       -- the default call to action
  content_rules_md text,  -- the writer's playbook: what to produce and how (drives the AI writer)
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists set_brand_profiles_updated_at on company_os.brand_profiles;
create trigger set_brand_profiles_updated_at before update on company_os.brand_profiles
  for each row execute function company_os.handle_updated_at();

alter table company_os.brand_profiles enable row level security;

grant select, insert, update, delete on company_os.brand_profiles to service_role;
grant select on company_os.brand_profiles to supabase_read_only_user;

insert into company_os.brand_profiles (brand_id, positioning, audience, voice_md, offer, primary_cta, content_rules_md, updated_by)
select b.id,
  'Edge8 is a founder-to-founder AI staffing and advisory firm. We help companies understand their business and AI deeply before they staff up, then place the engineers and AI leaders who can actually build and run it.',
  'Primary: founders and CEOs who know they need AI talent but are not sure what roles to hire or how to evaluate them, and have often been burned by overpromising hires or consultants. Secondary: CTOs and technical leaders who need credible staffing support and know the difference between an ML engineer and a prompt engineer.',
  $v$Dave Hajdu, founder of Edge8, speaking as someone who has sat across the table from founders and CTOs. Direct, confident, no-nonsense, business-forward. You are talking to decision-makers about a real operational problem: getting the right AI talent into their organization. Not hype, not recruiter fluff. Peer to peer, founder to founder. Never use em dashes. Write "Edge8" exactly like that.$v$,
  'AI engineer staffing, AI officer staffing, adjacent technical staffing, and AI audits (understanding where an organization is before it hires or sets strategy).',
  'Reply to talk about the roles you actually need, or book an AI audit before you hire.',
  $r$## What to produce for Edge8

Default deliverable set for a "write" request, unless told otherwise: an email newsletter, a LinkedIn post, and a Facebook post, all re-purposed from the same core idea. Never cross-post identical text.

## The lens

Lead with the business problem: the cost of the wrong hire, the gap in AI leadership, the audit that should have happened first. Take a position on how companies should approach AI talent. Practical and opinionated, from someone who does the work, not a recruiter pitch. No jargon without defining it. Always close with a clear next step, never vague.

## By channel

- **Email newsletter**: subject that names the problem or the stakes; preheader that adds the payoff; body 150-300 words, founder-to-founder, one clear insight, end on a soft consulting/staffing CTA and a link to the source.
- **LinkedIn**: hook in the first line that earns the scroll; staccato lines, one idea per line, generous white space; the staffing decisions companies get wrong or what to look for in AI talent; end with a strong declarative statement; 3-5 hashtags.
- **Facebook**: 2-4 conversational sentences to founders and CTOs; one insight; end with "[Link in first comment]".

## Blog styles to reach for (from the content-studio catalogue)

The Argument, The Contrarian, The Warning, The Case Study, The Letter ("Dear founder"). Pick the one that fits the idea.$r$,
  'seed:content-studio'
from company_os.brands b where b.slug = 'edge8'
on conflict (brand_id) do nothing;

insert into company_os.brand_profiles (brand_id, positioning, audience, voice_md, offer, primary_cta, content_rules_md, updated_by)
select b.id,
  'The AI Officer Institute is a certification and education company. We certify that leaders can actually lead in the AI era, proven by the work they produce, not by attendance. Flagship: the Leadership in the AI Era program built with Dr. Brooks Holtom of Georgetown and David Nilssen.',
  'Senior leaders and executives who want a credential that means something, and the organizations that sponsor them. They value rigor, credibility, and proof.',
  $v$Academic, institutional, and credible, but not stiff. The voice of an institute: measured, authoritative, evidence-led (cite outcomes like the Perth 77 NPS, the three working deliverables). Lead with the standard and the proof. Keep Dr. Holtom and Georgetown factual (his faculty role); never imply an official Georgetown partnership or academic credit. Never use em dashes.$v$,
  'Certification Programs, led by Leadership in the AI Era.',
  'Explore the certification and how you earn it.',
  $r$## What to produce for the AI Officer Institute

Default deliverable set for a "write" request, unless told otherwise: an email, a LinkedIn post, and a Facebook post, re-purposed from one core idea. Never cross-post identical text.

## The lens

The core frame is challenge-based certification: a credential proves capability, not attendance. "You pass by producing work, not by showing up." Emphasize the standard, the deliverables a participant builds, and the proof (NPS, cohorts, named faculty). Academic and rigorous, never hype. The villain is always attendance without proof, never certification itself.

## By channel

- **Email**: subject that leads with the standard or the proof; preheader adds credibility; body 150-300 words; end with a certification CTA and a link to the program or the source.
- **LinkedIn**: hook that earns the scroll; staccato lines; the angle is what real proof of AI capability looks like versus a certificate of attendance; end with a declarative statement; 3-5 hashtags.
- **Facebook**: 2-4 conversational sentences; one insight about earning versus attending; end with "[Link in first comment]".

## Blog styles to reach for

The Framework, The Research Dive, The Case Study, The Myth Buster, The Argument.$r$,
  'seed:content-studio'
from company_os.brands b where b.slug = 'ai-officer'
on conflict (brand_id) do nothing;

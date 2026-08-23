-- Expand brand_profiles to hold the full content-studio production process,
-- organised for the four-tab per-brand admin page (Basics | Voice | Channels |
-- Writing Process). The AI writer reads these so drafts actually run through the
-- style, channel rules, Shipper editing lens, and Patel SEO lens.
--
-- Seeded from content-studio: edge8/context/channels-and-guidelines.md,
-- context/workflow.md (the shared Shipper/Patel/process text), and the AI
-- Officer Institute certification positioning. content_rules_md is kept as a
-- nullable legacy column and can be dropped once nothing reads it.
-- Applied via Supabase MCP.

alter table company_os.brand_profiles
  add column if not exists author_md text,        -- Basics: author persona + credentials
  add column if not exists rules_md text,         -- Voice: hard rules (no em dashes, name casing, do/don't)
  add column if not exists channels_md text,      -- Channels: per-channel guidelines
  add column if not exists process_md text,       -- Writing Process: the workflow
  add column if not exists blog_styles_md text,   -- Writing Process: the style catalogue + this brand's picks
  add column if not exists editing_lens_md text,  -- Writing Process: Shipper editing lens
  add column if not exists seo_lens_md text,      -- Writing Process: Patel SEO lens
  add column if not exists image_style_md text;   -- Writing Process: brand palette + image guidance

-- Shared process text (same for both brands; each may diverge later).
update company_os.brand_profiles set
  process_md = $p$## Blog production workflow
1. Develop the idea: sharpen the core argument, who it is for, and what the reader should think, feel, or do after reading.
2. Pick the style that fits (see Blog styles).
3. Outline, then run it through the editing lens before drafting.
4. Draft: 800 to 1500 words, subheadings that tell the story on their own, a hook that makes the reader feel seen, a clear takeaway at the close, in this brand's voice.
5. SEO: title tag, meta description, primary and secondary keywords, slug, and five link opportunities (internal first). Run it through the SEO lens.
6. Deliverables: the channel posts (see Channels).
7. Images: follow the image style; state the palette before generating.$p$,
  editing_lens_md = $e$## Editing lens (Dan Shipper)
Before a draft is approved, check:
- Is the thinking sharp? Does every section earn its place?
- Is there filler masquerading as insight?
- Does the structure build an argument, or just list things?
- Is the opening doing real work, or is it throat-clearing?
- Would a smart, busy reader finish this?
Suggest cuts, reorders, and sharpening. Kill anything that does not earn its place.$e$,
  seo_lens_md = $s$## SEO lens (Neil Patel)
- Keyword realism: would the audience actually type this into Google? Coined or branded terms belong in entity definitions and schema, not the title tag.
- Competition realism: who ranks page one today? If it is owned by Forbes, HBR, or the term's originator, pick a long-tail alternative the site can win.
- Intent match: does the keyword match a searcher who would take the CTA? Question-format keywords win AI Overviews and snippets.
- Title tag vs H1: the H1 is the brand hook for humans; the title tag is keyword-led for search. Split them when the H1 has no searchable keyword.
- Meta description: lead with the keyword, name the benefit, end on a hook.
- Links: five per post, internal first, descriptive anchor text; external links open in a new tab.
- AI search: FAQ schema answers the three to five questions an LLM would extract; entity definitions are clean.$s$
where brand_id in (select id from company_os.brands where slug in ('edge8', 'ai-officer'));

-- Edge8: founder-to-founder staffing and advisory.
update company_os.brand_profiles set
  author_md = $a$**Dave Hajdu**, founder of Edge8. Speaks as someone who has sat across the table from founders and CTOs and understands both the business and the technical side of AI. Direct, confident, no-nonsense.

Credentials (use what is relevant, not all at once): started at Microsoft building automations that moved data and money at enterprise scale; 20-year entrepreneur; founded TINYpulse (raised $9.5M led by Baseline Ventures); EO global tech committee; founder of the AI Officer Institute.$a$,
  rules_md = $r$- Write "Edge8" exactly like that. Never all caps.
- Never use em dashes. Use commas, colons, periods, or parentheses.
- No jargon without defining it in plain language.
- Take a position; do not hedge.
- Always close with a clear next step, never vague.$r$,
  channels_md = $c$## Active channels
Blog, LinkedIn, Facebook, email.

## Blog
800 to 1500 words. Written to founders and CTOs making AI staffing and strategy decisions. Lead with the business problem: the cost of the wrong hire, the gap in AI leadership, the audit that should have happened first. Practical and opinionated, from someone who does the work, not a recruiter pitch. Close with a clear next step.

## LinkedIn
Hook in the first line that earns the scroll. Staccato lines, one idea per line, generous white space. Angle: the staffing decisions companies get wrong, what to look for in AI talent, why an audit comes before a hire. End with a strong declarative statement. 3 to 5 hashtags.

## Facebook
2 to 4 conversational sentences to founders and CTOs. One insight about AI staffing or strategy. End with "[Link in first comment]".

## Email
Subject that names the problem or the stakes. Preheader that adds the payoff. Body 150 to 300 words, founder to founder, one clear insight, end on a soft consulting or staffing CTA and a link to the source.$c$,
  blog_styles_md = $b$Pick the one style that fits the idea. Edge8 reaches most often for: The Argument, The Contrarian, The Warning, The Case Study, and The Letter ("Dear founder").

Full catalogue: The Argument, The Framework, The List, The Story, The Contrarian, The How-To, The Trend Report, The Case Study, The Myth Buster, The Comparison, The Interview, The Prediction, The Warning, The Origin Story, The Letter, The Behind the Scenes, The Roundup, The Personal Essay, The Research Dive, The Quick Win.$b$,
  image_style_md = $i$Edge8 palette, editorial, not clip-art. Use only these colors and the Manrope typeface. Navy #04102D as the ground, Blue #287BE8, Magenta #D1458B, Mint #6FF2C1 as accents, Warm Amber #E9A23B sparingly. Headlines in normal sentence case; uppercase only for tiny tracked section labels. Default to mixed media: real photos for human anchors, clean AI-generated concept cards for ideas. State the palette out loud before generating.$i$
where brand_id = (select id from company_os.brands where slug = 'edge8');

-- AI Officer Institute: certification and education.
update company_os.brand_profiles set
  author_md = $a$The **AI Officer Institute**, founded by Dave Hajdu. The voice is the institute: measured, authoritative, evidence-led. Its flagship is the Leadership in the AI Era program, built with Dr. Brooks Holtom of Georgetown and David Nilssen.

Credentials (factual only): three-series program producing three working AI deliverables; Perth pilot scored a 77 NPS; runs in Vietnam, Dubai, and Washington, DC. Keep Dr. Holtom and Georgetown factual (his faculty role); never imply an official Georgetown partnership or academic credit.$a$,
  rules_md = $r$- Never use em dashes.
- The core frame is challenge-based certification: a credential proves capability, not attendance. "You pass by producing work, not by showing up."
- The villain is always attendance without proof, never certification itself.
- Keep Georgetown and Dr. Holtom factual; never imply an official partnership or academic credit.
- Lead with the standard and the proof (NPS, deliverables, named faculty).$r$,
  channels_md = $c$## Active channels
Blog, LinkedIn, Facebook, email.

## Blog
800 to 1500 words. Written to senior leaders and the organizations that sponsor them. Academic and rigorous, never hype. Emphasize the standard, the deliverables a participant builds, and the proof. Close with a certification next step.

## LinkedIn
Hook that earns the scroll. Staccato lines. Angle: what real proof of AI capability looks like versus a certificate of attendance. End with a declarative statement. 3 to 5 hashtags.

## Facebook
2 to 4 conversational sentences. One insight about earning versus attending. End with "[Link in first comment]".

## Email
Subject that leads with the standard or the proof. Preheader adds credibility. Body 150 to 300 words. End with a certification CTA and a link to the program or the source.$c$,
  blog_styles_md = $b$Pick the one style that fits the idea. The AI Officer Institute reaches most often for: The Framework, The Research Dive, The Case Study, The Myth Buster, and The Argument.

Full catalogue: The Argument, The Framework, The List, The Story, The Contrarian, The How-To, The Trend Report, The Case Study, The Myth Buster, The Comparison, The Interview, The Prediction, The Warning, The Origin Story, The Letter, The Behind the Scenes, The Roundup, The Personal Essay, The Research Dive, The Quick Win.$b$,
  image_style_md = $i$AI Officer Institute, academic and minimal. Deep navy ground with a single restrained accent and generous white space. Clean editorial diagrams over decoration. Headlines in sentence case. Prefer concept diagrams and credible, understated imagery; avoid hype visuals. Confirm the exact brand palette before a real generation run (AIO tokens to be added).$i$
where brand_id = (select id from company_os.brands where slug = 'ai-officer');

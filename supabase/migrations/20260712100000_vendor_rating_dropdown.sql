-- Applied 2026-07-12 via Supabase MCP migration `vendor_rating_dropdown`.
-- Rating becomes a fixed vocabulary (Preferred / Average / Poor Experience /
-- To Consider). Normalize seeded values: the VF8 qualifier already lives in
-- that vendor's notes; "Ruled out" is not a rating in the new taxonomy, so it
-- moves into notes.
update company_os.vendors
   set rating = 'Preferred', updated_at = now()
 where rating like 'Preferred%' and rating <> 'Preferred';

update company_os.vendors
   set notes = 'Ruled out. ' || coalesce(notes, ''),
       rating = null,
       updated_at = now()
 where rating = 'Ruled out';

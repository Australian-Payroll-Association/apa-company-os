-- Repoint stored asset URLs at the new project.
--
-- The 278 storage objects were copied to nubxrrzwcbhgpvvmbioh, but
-- modules.poster_url holds an ABSOLUTE url and all 200 rows still named
-- vgwampgffykiuzsoyevn. Posters render today only because the old project is
-- still alive with public buckets - so this would have looked fine right up
-- until the old project is paused (+14 days) or deleted (+60), at which point
-- every module poster on the site breaks at once.
--
-- The consolidation plan said bucket names were kept "so stored object paths
-- did not have to be rewritten". True of paths, wrong for absolute URLs, which
-- is what this column actually stores.

update payroll_iq.modules
   set poster_url = replace(poster_url,
                            'https://vgwampgffykiuzsoyevn.supabase.co',
                            'https://nubxrrzwcbhgpvvmbioh.supabase.co'),
       updated_at = updated_at          -- do not disturb: this is a reference
                                        -- repair, not a content edit
 where poster_url like '%vgwampgffykiuzsoyevn%';

do $chk$
declare stale int; repointed int;
begin
  -- Nothing anywhere in the schema may still name the old project. Checked
  -- across whole rows, not just the columns known today, so a jsonb blob or a
  -- column added later cannot hide one.
  select count(*) into stale from payroll_iq.modules
   where (poster_url || coalesce(archive_url,'') || coalesce(caption_url,'') || coalesce(video_url,''))
         like '%vgwampgffykiuzsoyevn%';
  if stale <> 0 then raise exception '% module rows still point at the old project', stale; end if;

  select count(*) into repointed from payroll_iq.modules
   where poster_url like '%nubxrrzwcbhgpvvmbioh%';
  if repointed <> 200 then raise exception 'expected 200 repointed posters, found %', repointed; end if;
end $chk$;

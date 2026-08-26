-- Attaching a call transcript to a performance review creates a
-- company_os.meetings row with source='review', but meetings_source_check did
-- not allow that value (it exposed "new row violates check constraint
-- meetings_source_check"). Add 'review' to the allowed sources, alongside the
-- existing lark / thoughtflow / manual / zoom / google / other / notes /
-- coaching. Already applied to prod.

alter table company_os.meetings drop constraint meetings_source_check;
alter table company_os.meetings add constraint meetings_source_check
  check (source = any (array['lark','thoughtflow','manual','zoom','google','other','notes','coaching','review']));

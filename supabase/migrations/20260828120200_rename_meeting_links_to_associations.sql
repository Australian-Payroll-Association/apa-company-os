-- Rename company_os.meeting_links -> company_os.meeting_associations.
--
-- The name reads like it holds meeting URLs, but per-meeting URLs already live
-- on meetings (transcript_url / recording_url / minutes_url). This table is the
-- polymorphic "what this meeting is about" list: (meeting_id, entity_type,
-- entity_id), where a meeting can relate to several things (a deal, a company,
-- a client project, ...) and to more than one at once. Renamed to reflect that.
-- Data preserved (12 rows across 6 meetings at time of rename).
alter table if exists company_os.meeting_links rename to meeting_associations;

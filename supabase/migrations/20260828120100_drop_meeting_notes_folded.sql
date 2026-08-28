-- Drop company_os.meeting_notes now that it has been folded into meetings.
--
-- scripts/meetings/03-fold-meeting-notes.mjs copied every meeting_notes row
-- into company_os.meetings (source='notes', PRESERVING the id so URLs survive)
-- and moved its transcript into company_os.call_transcripts. The live app
-- reads/writes notes as source='notes' rows on meetings; nothing reads
-- meeting_notes any more. Verified on prod before this migration: the fold is
-- complete (the surviving row exists in meetings with its transcript in
-- call_transcripts).
drop table if exists company_os.meeting_notes;

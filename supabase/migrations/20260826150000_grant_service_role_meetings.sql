-- company_os.meetings granted service_role SELECT only, so the app (which talks
-- to the DB as service_role via the secret key) could read meetings but not
-- create them. Coaching and admin-notes usually reuse an existing meeting row,
-- so the insert path was rarely hit; attaching a call transcript to a
-- performance review (source='review') creates a fresh meeting and exposed the
-- gap ("permission denied for table meetings"). Bring meetings in line with
-- call_transcripts / meeting_notes: service_role may write as well as read.

grant insert, update, delete on company_os.meetings to service_role;

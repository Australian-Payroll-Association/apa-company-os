-- One row per storage object. Without this, a second row could claim an
-- existing object's path (recordDocument only checks the company prefix), and
-- the uploader-only delete on that second row would remove a file the first
-- row still points at.
create unique index if not exists program_documents_storage_path_key
  on company_os.program_documents (storage_path);

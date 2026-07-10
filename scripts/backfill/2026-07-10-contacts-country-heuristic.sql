-- Backfill: contact country by name/email heuristic, for contacts still Unknown
-- after the linked-company pass. Rules (Dave's, in precedence order):
--   1. email on an .au domain            -> Australia
--   2. Vietnamese name (diacritics OR a   -> Vietnam
--      Vietnamese surname/given-name token)
--   3. any other non-empty name          -> United States  (broad catch-all)
-- Nameless contacts stay Unknown. Guarded on country null: idempotent, never
-- overwrites. Applied 2026-07-10 via Supabase MCP against wwchefrgkkxmhlkntufm.
-- Result: Unknown 498 -> 4; Vietnam +366, United States +150, Australia +2.
--
-- CAVEAT: rule 3 is a deliberate simplification. It labels every remaining
-- Latin-script name United States, which mislabels some Malaysian / Singaporean
-- / HK / Filipino contacts (e.g. "Iris Teoh", "Chung Lam", "Eric Enriquez").
-- Kept as instructed; fully reversible per-contact from the edit form.

update company_os.people p
set country = c.val, updated_at = now()
from (
  select id,
    case
      when lower(email) ~ '\.au$' then 'Australia'
      when lower(full_name) ~ '[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]'
        or lower(full_name) ~ '\y(nguyen|tran|pham|hoang|huynh|phan|dang|bui|ngo|duong|trinh|dinh|luong|truong|vuong|dao|cao|doan|quach|le|vo|vu|do|ho|ly|mai|ta|thai|chau|kieu|luu|chu|tong|ha|an|lam|thi|thanh|huong|hanh|nhung|trang|linh|phuong|quang|minh|tuan|hung|dung|thuy|ngoc|khanh|cuong|hieu|trung|viet|hoa|thao|giang|quyen|oanh|tien|bao|hang|nga|lan|yen|duc|nam|long|phong|son|tam|hai|anh|uyen|tram|dat|khang|phuc|nhi|kha|thu|vy|xuan|vinh|tri|kien|nghia|thang|thien|hoai|khoa|diep|bich|ngan|nhu|thinh|toan|quy|dai|gia|cam|dieu|huy|duy|hoan|khoi|truc|quan|phat|tai|loc|kiet)\y'
        then 'Vietnam'
      when full_name is not null and full_name <> '' then 'United States'
      else null
    end as val
  from company_os.people
  where archived_at is null and (country is null or country = '')
) c
where p.id = c.id and c.val is not null;

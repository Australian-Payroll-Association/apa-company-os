-- Canonical short name for person pickers: Given + Family, in that order.
-- company_os.people.full_name mixes Vietnamese order (Nguyen Chi Hieu = Family Middle Given)
-- with Western order (Khoa Doan = Given Family), and first_name/last_name are populated for
-- only 1 of the 26 active team members, so neither column can be sorted by first name.
-- display_name is the one attribute every picker reads and sorts on.
-- Additive only; company_os.people is shared with the CRM.
alter table company_os.people
  add column if not exists display_name text;

comment on column company_os.people.display_name is
  'Given name followed by family name, e.g. "Quan Le". Prefers the name the person goes by. Person pickers display and sort on this.';

-- Backfill for the current active roster, reviewed name by name 2026-08-12.
update company_os.people as p
set display_name = v.display_name
from (values
  ('Đặng Phương Mai',        'Mai Đặng'),
  ('David Joseph Hajdu',     'Dave Hajdu'),
  ('Ha Nguyen',              'Hạ Nguyen'),
  ('Khoa Doan',              'Khoa Doan'),
  ('Lê Minh Quân',           'Quân Lê'),
  ('Lê Minh Tân',            'Tân Lê'),
  ('Lê Tấn Khôi',            'Khôi Lê'),
  ('Lê Vinh',                'Harry Lê'),
  ('Loi Nguyen',             'Lợi Nguyen'),
  ('Ly Doan Van Anh',        'Ash Ly'),
  ('My Pham',                'My Pham'),
  ('Nghiem Cam Viet Ha',     'Viha Nghiem'),
  ('Ngoc Le',                'Jasper Le'),
  ('Nguyễn Chí Hiếu',        'Hieu Nguyễn'),
  ('Nguyễn Hữu Thành',       'Thành Nguyễn'),
  ('Nguyễn Minh Tâm',        'Tâm Nguyễn'),
  ('Nguyễn Văn Đức',         'Đức Nguyễn'),
  ('Phạm Thị Hoàng Lan Anh', 'Lan Anh Phạm'),
  ('Quan Chau',              'Quan Chau'),
  ('Quang Van',              'Quang Van'),
  ('Trần Nhật Thanh',        'Thanh Trần'),
  ('Trần Thanh Bình',        'Bình Trần'),
  ('Trương Bá Trung',        'Ethan Trương'),
  ('Võ Quỳnh Chi',           'Ginny Võ'),
  ('Vũ Trần Minh',           'Minh Vũ'),
  ('Yon Vo',                 'Yon Vo')
) as v(full_name, display_name)
where p.full_name = v.full_name
  and p.display_name is null
  and exists (
    select 1 from company_os.team_members tm
    where tm.person_id = p.id and tm.status in ('active', 'on_leave', 'notice')
  );

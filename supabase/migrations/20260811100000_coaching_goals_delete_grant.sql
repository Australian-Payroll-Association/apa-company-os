-- Managers can Add / Edit / Delete FAST goals for any team member (Dave,
-- 2026-08-11). Goals are the one coaching table with a true delete: removing
-- a mis-set goal should not leave a tombstone, and comments cascade with it.
-- Access is enforced app-side: profile's coach OR the manager role.

grant delete on company_os.coaching_goals to service_role;

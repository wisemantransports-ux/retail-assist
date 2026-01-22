-- =============================================
-- 033_add_full_name_to_employee_invites.sql
-- Add full_name column to employee_invites table
-- =============================================

-- Add full_name column to store the accepted user's full name
alter table public.employee_invites 
add column if not exists full_name text;

-- Add comment for documentation
comment on column public.employee_invites.full_name is 'Full name of the employee who accepted the invite (populated after acceptance)';

-- =============================================
-- END OF 033
-- =============================================

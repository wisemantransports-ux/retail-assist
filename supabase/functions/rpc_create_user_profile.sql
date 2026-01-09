
-- RPC: rpc_create_user_profile
-- Inserts a row into public.users with safe defaults and returns the created row.
-- SECURITY DEFINER allows the function to run with the function owner's privileges so the service-role can bypass RLS.
CREATE OR REPLACE FUNCTION public.rpc_create_user_profile(
    p_auth_uid uuid,
    p_business_name text,
    p_email text,
    p_full_name text default null,
    p_phone text,
    p_plan_type text default 'starter'
)
RETURNS public.users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
    inserted_user users%rowtype;
begin
    insert into public.users (
        auth_uid, email, full_name, business_name, phone, plan_type,
        role, payment_status, subscription_status, created_at, updated_at
    )
    values (
        p_auth_uid, p_email, p_full_name, p_business_name, p_phone, p_plan_type,
        'user', 'unpaid', 'pending', now(), now()
    )
    returning * into inserted_user;

    return inserted_user;
end;
$$;

-- Grant execute to anon (if desired), but service-role should be used by server code.
-- GRANT EXECUTE ON FUNCTION public.rpc_create_user_profile(uuid,text,text,text,text,text) TO anon;

-- Ensure service-role can operate on users and sessions tables (adjust role name if different in your Postgres setup)
-- These grants are for guidance; apply them in your Supabase SQL editor if needed.
-- GRANT insert, update, select ON TABLE public.users TO service_role;
-- GRANT insert, update, select ON TABLE public.sessions TO service_role;

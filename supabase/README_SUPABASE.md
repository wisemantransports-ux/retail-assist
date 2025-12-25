# Applying Supabase migrations (minimal guidance)

You can apply the SQL files in `supabase/migrations` either via `psql` or the `supabase` CLI. Below are reliable commands you can run from your development machine or CI.

Environment variables required:
- `SUPABASE_DB_USER`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DB_HOST` (e.g. db.yourproject.supabase.co)
- `SUPABASE_DB_PORT` (usually 5432)
- `SUPABASE_DB_NAME`
- `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)

Run all migrations with `psql` (safe and explicit):

```bash
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
for f in supabase/migrations/*.sql; do
  echo "--- applying $f"
  psql "postgresql://$SUPABASE_DB_USER@$SUPABASE_DB_HOST:$SUPABASE_DB_PORT/$SUPABASE_DB_NAME" -f "$f"
done
```

Recommended order and notes:

- 001/002: base schema (existing)
- 003: minimal mvp schema (adds helper functions)
- 004: RLS policies + seed placeholders (contains seed rows with placeholder `auth_uid` values)
- 005: Finalized RLS and production-ready policies (created by this commit)

Important: before running 004/005, create Auth users in Supabase Auth, then replace the placeholder `auth_uid` strings in `004_rls_policies_and_seed.sql` with the real `auth.uid()` UUIDs for your seeded users. Alternatively, create auth users, fetch their UIDs, then insert matching rows into `users`.

Checklist - mock → live switch (quick):

1. Create your Supabase project and obtain values for `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
2. Populate your environment (local `.env` or CI) with the keys and database connection vars: `SUPABASE_DB_HOST`, `SUPABASE_DB_USER`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_NAME`, `SUPABASE_DB_PORT`.
3. Run the `psql` loop above to apply migrations in `supabase/migrations` in order.
4. Create Auth users in Supabase Auth for admin/demo/test. Note their `id` (UID) values.
5. Update `supabase/migrations/004_rls_policies_and_seed.sql` to replace placeholder `auth_uid` values with real UIDs, or insert rows into `users` mapping `auth_uid` -> `users.id`.
6. In your app `.env` (local), set `NEXT_PUBLIC_USE_DEV_AUTH=false` and `USE_MOCK_DB=false`.
7. Restart the dev server and test: sign in as seeded users and confirm dashboards load. Attempt write actions from a pending workspace — they should be rejected by RLS and your UI should show the upsell modal.
8. For admin operations (migrations, billing, webhooks), use the `SUPABASE_SERVICE_ROLE_KEY` only on server code; never expose it to the browser.

Testing notes:
- To validate RLS quickly, use the Supabase SQL editor logged in as a seeded auth user and attempt a write against `agents` in a workspace whose `subscription_status` is `pending` — you should be blocked.
- To bypass and confirm write behavior when active, set the workspace `subscription_status` to `active` and re-run the same query.


If you prefer the Supabase CLI and your project is configured, you can try:

```bash
supabase db push
```

But the `psql` loop above will always work if you have DB credentials and network access.

Notes:
- The seed in `004_rls_policies_and_seed.sql` includes placeholder `auth_uid` values. Replace those with real `auth.uid()` values from Supabase Auth users or create the auth users first and update the seed before applying.
- Ensure `SUPABASE_SERVICE_ROLE_KEY` is present for server-side service operations; never commit it to source control.

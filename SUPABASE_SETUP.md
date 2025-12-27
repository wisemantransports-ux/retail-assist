# Supabase Setup & Migrations (Step-by-Step Guide)

## Overview

This guide walks you through provisioning a Supabase project, applying migrations, creating users, and testing the backend with RLS policies.

---

## 1. Create a Supabase project

1. Go to https://app.supabase.com
2. Click **New Project** and create one for staging
3. Once created, go to **Settings** → **API** and copy:
   - **Project URL** → save as `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon public key** → save as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service role key** → save as `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)
4. Go to **Settings** → **Database** → **Connection Info** and copy:
   - **Host** → `SUPABASE_DB_HOST`
   - **User** → `SUPABASE_DB_USER` (usually `postgres`)
   - **Password** → `SUPABASE_DB_PASSWORD`
   - **Database** → `SUPABASE_DB_NAME` (usually `postgres`)
   - **Port** → `SUPABASE_DB_PORT` (usually `5432`)

---

## 2. Set up local environment

Copy the `.env.example` template:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in all the values from step 1. Keep it secure (never commit it).

Example:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLC...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLC...
SUPABASE_DB_HOST=db.your-project.supabase.co
SUPABASE_DB_USER=postgres
SUPABASE_DB_PASSWORD=your-secure-password
SUPABASE_DB_NAME=postgres
SUPABASE_DB_PORT=5432
NEXT_PUBLIC_USE_DEV_AUTH=false
USE_MOCK_DB=false
```

---

## 3. Apply migrations

Ensure you have `psql` installed:

```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt install postgresql-client
```

Then run the migration loop:

```bash
export PGPASSWORD="$SUPABASE_DB_PASSWORD"
for f in supabase/migrations/*.sql; do
  echo "=== applying $f"
  psql "postgresql://$SUPABASE_DB_USER@$SUPABASE_DB_HOST:$SUPABASE_DB_PORT/$SUPABASE_DB_NAME" -f "$f"
done
```

Expected order:
1. `001_initial_schema.sql`
2. `002_complete_schema.sql`
3. `003_minimal_mvp_schema.sql`
4. `004_rls_policies_and_seed.sql`
5. `005_finalize_mvp_schema.sql`

If any migration fails, read the error message and fix the SQL. Common issues:
- **psql not found**: install PostgreSQL client (see above)
- **authentication failed**: check `SUPABASE_DB_PASSWORD` and username
- **relation exists**: that table was already created (safe to continue)

---

## 4. Create Auth users in Supabase

1. In Supabase console, go to **Authentication** → **Users**
2. Click **Add user** and create:
   - **Email:** `samuelhelp80@gmail.com`
   - **Password:** `123456`
3. Click the user row to open details and copy the **User ID** (UID)
4. Create more test users if desired (admin, demo, etc.)

---

## 5. Map Auth users to public.users

In the Supabase SQL editor (in the console), run:

```sql
INSERT INTO public.users (id, auth_uid, email, full_name) VALUES
  (gen_random_uuid(), '<PASTE_AUTH_UID_HERE>', 'samuelhelp80@gmail.com', 'Samuel');
```

Replace `<PASTE_AUTH_UID_HERE>` with the UID you copied in step 4.

Then create a demo workspace owned by this user:

```sql
INSERT INTO workspaces (id, owner_id, name, plan_type, subscription_status, payment_status, plan_limits)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM users WHERE email = 'samuelhelp80@gmail.com' LIMIT 1),
  'Demo Workspace',
  'starter',
  'active',
  'paid',
  '{"maxPages":1,"hasInstagram":false}'::jsonb
);
```

Copy the workspace `id` from the output (or run `SELECT id FROM workspaces WHERE name = 'Demo Workspace' LIMIT 1;`).

---

## 6. Switch the app to live Supabase

Edit `.env.local` and change:

```bash
NEXT_PUBLIC_USE_DEV_AUTH=false
USE_MOCK_DB=false
```

Then restart the dev server:

```bash
npm run dev
```

Visit http://localhost:5000 and sign in with:
- **Email:** `samuelhelp80@gmail.com`
- **Password:** `123456`

You should see the dashboard load. The workspace will be active (subscription_status = 'active'), so write actions (create agent, add automation) will be allowed.

---

## 7. Run automated policy tests

Set the workspace ID from step 5:

```bash
export TEST_WORKSPACE_ID="<PASTE_WORKSPACE_ID_HERE>"
```

Then run the test script:

```bash
npm run test:supabase
```

Expected output:
1. **GET agents** → HTTP 200 (members can read)
2. **POST agent (workspace pending)** → HTTP 401/403 (RLS blocks write)
3. **Workspace set to active** → success
4. **POST agent (workspace active)** → HTTP 201 (write allowed)
5. **Workspace reverted to pending** → success

This confirms:
- Reads work for members
- Writes are blocked when `subscription_status != 'active'`
- Writes work when active
- Service role key can bypass and manage subscription status

---

## 8. Test the Upsell Modal

Create a second workspace with `subscription_status = 'pending'`:

```sql
INSERT INTO workspaces (id, owner_id, name, plan_type, subscription_status, payment_status, plan_limits)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM users WHERE email = 'samuelhelp80@gmail.com' LIMIT 1),
  'Read-Only Workspace',
  'starter',
  'pending',
  'unpaid',
  '{"maxPages":1,"hasInstagram":false}'::jsonb
);
```

Add the user to this workspace:

```sql
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT '<WORKSPACE_ID_FROM_INSERT>', id, 'admin'
FROM users WHERE email = 'samuelhelp80@gmail.com'
LIMIT 1;
```

Sign in and switch to this workspace. Try creating an agent or automation — the **Upsell Modal** should appear, blocking the action.

---

## 9. Optional: Use Supabase CLI (if installed)

If you prefer the CLI over psql:

```bash
supabase link --project-ref your-project-id
supabase db push
```

Otherwise, the `psql` loop is simpler and just as reliable.

---

## Security Best Practices

✅ **DO:**
- Store `SUPABASE_SERVICE_ROLE_KEY` in a secret manager (1Password, AWS Secrets Manager, Vercel Secrets, etc.)
- Use `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the browser — RLS enforces row-level restrictions
- Use `SUPABASE_SERVICE_ROLE_KEY` only in server-side code (`/app/api`, `/app/lib/supabase/serverClient.ts`)
- Rotate keys periodically

❌ **DON'T:**
- Commit `.env.local`, `.env`, or service role keys to Git
- Log or expose service role keys to the client
- Use service role key in browser-side code

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `psql: command not found` | Install PostgreSQL client (`brew install postgresql` on macOS, `apt install postgresql-client` on Ubuntu) |
| `FATAL: password authentication failed` | Check `SUPABASE_DB_PASSWORD` and `SUPABASE_DB_USER` |
| `ERROR: duplicate key value violates unique constraint` | Migration already ran; safe to continue |
| RLS blocks all queries | Check Supabase SQL editor as service role; queries work, but user role is restricted |
| Auth user not in `public.users` | Run step 5 to insert the mapping |
| Test script fails on POST agent | Ensure `TEST_WORKSPACE_ID` is set and workspace is in your Supabase project |

---

## Next Steps

1. ✅ Supabase project provisioned
2. ✅ Migrations applied
3. ✅ Auth users created
4. ✅ App wired to live DB (mock mode disabled)
5. → Test the dashboard and RLS policies
6. → Merge UI PR when confident
7. → Set up CI to auto-run migrations and tests on pull requests

For questions or issues, check the Supabase docs at https://supabase.com/docs.

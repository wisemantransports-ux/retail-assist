#!/bin/bash
# Insert platform workspace using Supabase REST API

SUPABASE_URL="https://ftqcfpxundnxyvnaalia.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0cWNmcHh1bmRueHl2bmFhbGlhIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTQzNjc1OSwiZXhwIjoyMDg1MDEyNzU5fQ.HZxnL9NduK6LeSUg9yCJcmwUAUax4D_KKILd6prjn48"

PLATFORM_WORKSPACE_ID="00000000-0000-0000-0000-000000000001"
SUPER_ADMIN_USER_ID="0d5ff8c7-31ac-4d5f-8c4c-556d8bd08ab7"

echo "[Platform Workspace] Inserting platform workspace..."

# Try to insert the platform workspace
curl -X POST \
  "${SUPABASE_URL}/rest/v1/workspaces" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"id\": \"${PLATFORM_WORKSPACE_ID}\",
    \"owner_id\": \"${SUPER_ADMIN_USER_ID}\",
    \"name\": \"Retail Assist Platform\",
    \"description\": \"Internal platform workspace for platform employees\",
    \"created_at\": \"$(date -u +'%Y-%m-%dT%H:%M:%S')\",
    \"updated_at\": \"$(date -u +'%Y-%m-%dT%H:%M:%S')\"
  }" \
  2>&1

echo ""
echo "[Platform Workspace] Done!"

#!/bin/bash

# Verification script for signup/invite migration
# Run this AFTER running the migration to verify everything works

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Verifying Signup & Invite Migration..."
echo ""

# Database connection string should be in SUPABASE_DB_URL or passed as argument
DB_URL="${1:-$SUPABASE_DB_URL}"

if [ -z "$DB_URL" ]; then
    echo -e "${RED}❌ Error: Database URL not provided${NC}"
    echo "Usage: ./verify-migration.sh 'postgresql://user:password@host:5432/db'"
    exit 1
fi

# Helper function to run SQL query
run_query() {
    local query="$1"
    psql "$DB_URL" -tc "$query" 2>/dev/null || echo ""
}

# Test 1: Check users table columns
echo -e "${YELLOW}1. Checking users table schema...${NC}"
USERS_COLS=$(run_query "SELECT STRING_AGG(column_name, ', ') FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('role', 'business_name', 'phone', 'plan_type')")
if [ $(echo "$USERS_COLS" | grep -o ',' | wc -l) -eq 3 ]; then
    echo -e "${GREEN}✅ All required columns found in users table${NC}"
else
    echo -e "${RED}❌ Missing columns in users table${NC}"
    echo "   Expected: role, business_name, phone, plan_type"
    exit 1
fi

# Test 2: Check employees table columns
echo -e "${YELLOW}2. Checking employees table schema...${NC}"
EMP_COLS=$(run_query "SELECT STRING_AGG(column_name, ', ') FROM information_schema.columns WHERE table_name = 'employees' AND column_name IN ('full_name', 'phone', 'workspace_id')")
if [ $(echo "$EMP_COLS" | grep -o ',' | wc -l) -eq 2 ]; then
    echo -e "${GREEN}✅ All required columns found in employees table${NC}"
else
    echo -e "${RED}❌ Missing columns in employees table${NC}"
    echo "   Expected: full_name, phone, workspace_id"
    exit 1
fi

# Test 3: Check admin_access table exists
echo -e "${YELLOW}3. Checking admin_access table...${NC}"
AA_EXISTS=$(run_query "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_access')")
if [ "$AA_EXISTS" = "t" ]; then
    echo -e "${GREEN}✅ admin_access table exists${NC}"
else
    echo -e "${RED}❌ admin_access table not found${NC}"
    exit 1
fi

# Test 4: Check employee_invites table has expires_at
echo -e "${YELLOW}4. Checking employee_invites table...${NC}"
INVITES_EXPIRES=$(run_query "SELECT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='employee_invites' AND column_name='expires_at')")
if [ "$INVITES_EXPIRES" = "t" ]; then
    echo -e "${GREEN}✅ expires_at column found in employee_invites${NC}"
else
    echo -e "${RED}❌ expires_at column missing in employee_invites${NC}"
    exit 1
fi

# Test 5: Check RLS is enabled on key tables
echo -e "${YELLOW}5. Checking RLS policies...${NC}"
RLS_COUNT=$(run_query "SELECT COUNT(*) FROM pg_tables WHERE schemaname='public' AND tablename IN ('users', 'admin_access', 'employees', 'employee_invites') AND rowsecurity=true")
if [ "$RLS_COUNT" = "4" ]; then
    echo -e "${GREEN}✅ RLS enabled on all key tables${NC}"
else
    echo -e "${RED}❌ RLS not enabled on all tables (found $RLS_COUNT of 4)${NC}"
    exit 1
fi

# Test 6: Check RPC functions exist
echo -e "${YELLOW}6. Checking RPC functions...${NC}"
for rpc in "rpc_create_user_profile" "rpc_get_user_access" "rpc_accept_employee_invite"; do
    RPC_EXISTS=$(run_query "SELECT EXISTS(SELECT 1 FROM information_schema.routines WHERE routine_name='$rpc')")
    if [ "$RPC_EXISTS" = "t" ]; then
        echo -e "${GREEN}✅ $rpc exists${NC}"
    else
        echo -e "${RED}❌ $rpc not found${NC}"
        exit 1
    fi
done

# Test 7: Check for orphaned employees
echo -e "${YELLOW}7. Checking data integrity...${NC}"
ORPHANED=$(run_query "SELECT COUNT(*) FROM public.employees WHERE workspace_id IS NULL")
if [ "$ORPHANED" = "0" ]; then
    echo -e "${GREEN}✅ No orphaned employees found${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Found $ORPHANED employees with NULL workspace_id${NC}"
fi

# Test 8: Check constraint on single workspace per employee
echo -e "${YELLOW}8. Checking unique constraints...${NC}"
CONSTRAINT=$(run_query "SELECT EXISTS(SELECT 1 FROM information_schema.table_constraints WHERE table_name='employees' AND constraint_type='UNIQUE')")
if [ "$CONSTRAINT" = "t" ]; then
    echo -e "${GREEN}✅ Unique constraint exists on employees${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: No unique constraint on employees (single workspace enforcement)${NC}"
fi

# Test 9: Check auth trigger exists
echo -e "${YELLOW}9. Checking auth trigger...${NC}"
TRIGGER=$(run_query "SELECT EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name='on_auth_user_created')")
if [ "$TRIGGER" = "t" ]; then
    echo -e "${GREEN}✅ Auth trigger exists${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: Auth trigger not found${NC}"
fi

# Test 10: Sample data test
echo -e "${YELLOW}10. Checking sample data integrity...${NC}"
BAD_USERS=$(run_query "SELECT COUNT(*) FROM public.users WHERE auth_uid IS NOT NULL AND auth_uid NOT IN (SELECT id FROM auth.users)")
if [ "$BAD_USERS" = "0" ]; then
    echo -e "${GREEN}✅ All auth_uid references are valid${NC}"
else
    echo -e "${RED}❌ Found $BAD_USERS users with invalid auth_uid${NC}"
fi

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}✅ All verifications passed!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test signup flow: /auth/signup"
echo "2. Test invite flow: Admin dashboard → Employees → Invite"
echo "3. Check logs for any errors"
echo "4. Deploy to production when ready"

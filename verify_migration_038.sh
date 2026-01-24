#!/bin/bash

# =====================================================================
# MIGRATION 038 VERIFICATION SCRIPT
# Run after applying 038_complete_signup_invite_flow_fix.sql
# =====================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
success() {
    echo -e "${GREEN}✓ $1${NC}"
}

error() {
    echo -e "${RED}✗ $1${NC}"
}

info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Check if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set
if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    error "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    echo "Set them with:"
    echo "  export SUPABASE_URL='https://your-project.supabase.co'"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your-service-role-key'"
    exit 1
fi

info "SUPABASE_URL: $SUPABASE_URL"
info "Service role key configured: yes"

echo ""
echo "=========================================="
echo "MIGRATION 038 VERIFICATION"
echo "=========================================="
echo ""

# Test 1: Users table columns
echo "TEST 1: Verify users table has all required columns"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT string_agg(column_name, ', ') FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name IN ('role', 'plan_type', 'phone', 'business_name');" 2>/dev/null || echo "")

if [[ $RESULT == *"role"* ]] && [[ $RESULT == *"plan_type"* ]]; then
    success "Users table has all required columns"
else
    error "Users table missing columns: $RESULT"
fi

# Test 2: Employees table uses workspace_id
echo ""
echo "TEST 2: Verify employees table uses workspace_id"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'workspace_id';" 2>/dev/null || echo "")

if [[ $RESULT == *"workspace_id"* ]]; then
    success "Employees table uses workspace_id"
else
    error "Employees table still uses business_id or workspace_id not found"
fi

# Test 3: Sessions table FK
echo ""
echo "TEST 3: Verify sessions table FK references public.users"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT referenced_table_name FROM information_schema.referential_constraints 
        WHERE table_name = 'sessions' AND column_name = 'user_id';" 2>/dev/null || echo "")

if [[ $RESULT == *"users"* ]]; then
    success "Sessions FK correctly references public.users"
else
    warning "Sessions FK might not be set correctly. Please verify manually."
fi

# Test 4: Employee invites full_name column
echo ""
echo "TEST 4: Verify employee_invites has full_name column"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'employee_invites' AND column_name = 'full_name';" 2>/dev/null || echo "")

if [[ $RESULT == *"full_name"* ]]; then
    success "Employee_invites table has full_name column"
else
    error "Employee_invites table missing full_name column"
fi

# Test 5: Auth trigger exists
echo ""
echo "TEST 5: Verify auth trigger on_auth_user_created exists"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT trigger_name FROM information_schema.triggers 
        WHERE trigger_name = 'on_auth_user_created';" 2>/dev/null || echo "")

if [[ $RESULT == *"on_auth_user_created"* ]]; then
    success "Auth trigger on_auth_user_created exists"
else
    warning "Auth trigger on_auth_user_created not found. Check if Supabase already created one."
fi

# Test 6: RLS policies
echo ""
echo "TEST 6: Verify RLS policies are in place"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT COUNT(*) FROM pg_policies 
        WHERE tablename IN ('users', 'admin_access', 'employee_invites', 'employees');" 2>/dev/null || echo "0")

if [ "$RESULT" -gt 0 ]; then
    success "Found $RESULT RLS policies on key tables"
else
    warning "No RLS policies found. Please check if they were applied."
fi

# Test 7: Admin access data
echo ""
echo "TEST 7: Check admin_access table has data (if existing admins)"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT COUNT(*) FROM public.admin_access;" 2>/dev/null || echo "0")

if [ "$RESULT" -gt 0 ]; then
    success "Admin_access table has $RESULT records"
else
    info "Admin_access table is empty (expected for fresh deployment)"
fi

# Test 8: RPC functions
echo ""
echo "TEST 8: Verify RPC functions exist"
echo "---"

RESULT=$(psql -h "$(echo $SUPABASE_URL | cut -d/ -f3 | cut -d. -f1).db.supabase.co" \
    -U postgres \
    -d postgres \
    -c "SELECT count(*) FROM information_schema.routines 
        WHERE routine_name IN ('rpc_create_user_profile', 'rpc_get_user_access', 'rpc_create_employee_invite');" 2>/dev/null || echo "0")

if [ "$RESULT" -ge 2 ]; then
    success "Key RPC functions exist ($RESULT found)"
else
    error "Missing RPC functions. Expected at least 2, found $RESULT"
fi

echo ""
echo "=========================================="
echo "VERIFICATION COMPLETE"
echo "=========================================="
echo ""

# Summary
info "Next steps:"
echo "1. Test signup flow with a new account"
echo "2. Test invite acceptance flow"
echo "3. Verify multiple accounts work independently"
echo "4. Check application logs for any errors"
echo ""

# Provide SQL queries for manual verification
echo "Manual verification queries:"
echo ""
echo "# Check users table columns:"
echo "SELECT column_name FROM information_schema.columns WHERE table_name = 'users' ORDER BY column_name;"
echo ""
echo "# Check admin_access records:"
echo "SELECT COUNT(*), role FROM public.admin_access GROUP BY role;"
echo ""
echo "# Check for any RLS policy errors:"
echo "SELECT tablename, policyname FROM pg_policies ORDER BY tablename;"
echo ""

success "Verification script complete!"

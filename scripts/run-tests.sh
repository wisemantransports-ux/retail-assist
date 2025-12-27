#!/bin/bash
#
# Quick test runner for workspace provisioning and RLS enforcement
# Usage: bash scripts/run-tests.sh
#

set -e

echo "════════════════════════════════════════════════════════════════════════════════"
echo "🧪 RETAIL ASSIST: WORKSPACE PROVISIONING & RLS TEST SUITE"
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

# Check for .env
if [ ! -f .env ]; then
  echo "❌ Error: .env file not found"
  echo "   Create .env with SUPABASE_* variables (see SUPABASE_SETUP.md)"
  exit 1
fi

echo "📋 Test 1: Generate RLS Policies (if needed)"
echo "────────────────────────────────────────────────────────────────────────────────"
echo "Run this first if RLS policies need to be created/fixed:"
echo ""
echo "  node scripts/fix-and-apply-rls.js"
echo ""
echo "Then apply the SQL in Supabase dashboard."
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""

echo "📋 Test 2: Full Integration Test"
echo "────────────────────────────────────────────────────────────────────────────────"
echo "Run the comprehensive test:"
echo ""
echo "  node scripts/test-workspace-provisioning-and-rls.js"
echo ""
echo "This validates:"
echo "  ✓ Auth sign-in (admin@demo.com)"
echo "  ✓ User provisioning in public.users"
echo "  ✓ Workspace auto-creation"
echo "  ✓ Workspace membership creation"
echo "  ✓ Agent listing with RLS"
echo "  ✓ RLS enforcement (SELECT/INSERT)"
echo "  ✓ Service-role bypass"
echo ""
echo "════════════════════════════════════════════════════════════════════════════════"
echo ""
echo "📖 For detailed information, see: RLS_TESTING_GUIDE.md"
echo ""

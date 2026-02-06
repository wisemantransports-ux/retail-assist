#!/bin/bash
# Test complete employee invite flow: create invite → accept → login

set -e

BASE_URL="http://localhost:3000"
SUPER_ADMIN_TOKEN="$TEST_AUTH_TOKEN"
TEST_EMAIL="test-employee-$(date +%s)@demo.com"
TEST_PASSWORD="TestPassword123!"

echo "================================================"
echo "EMPLOYEE INVITE FLOW TEST"
echo "================================================"
echo ""

# Step 1: Create invite as super admin
echo "1️⃣  Creating employee invite..."
INVITE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/employees/invite" \
  -H "Authorization: Bearer $SUPER_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"invited_by_role\": \"super_admin\"
  }")

echo "Response: $INVITE_RESPONSE"
INVITE_TOKEN=$(echo "$INVITE_RESPONSE" | jq -r '.data.token // empty')

if [ -z "$INVITE_TOKEN" ]; then
  echo "❌ Failed to create invite"
  echo "Full response: $INVITE_RESPONSE"
  exit 1
fi

echo "✅ Invite created: $INVITE_TOKEN"
echo ""

# Step 2: Accept invite
echo "2️⃣  Accepting invite..."
ACCEPT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/employees/accept-invite?token=$INVITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"first_name\": \"Test\",
    \"last_name\": \"Employee\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Response: $ACCEPT_RESPONSE"
WORKSPACE_ID=$(echo "$ACCEPT_RESPONSE" | jq -r '.workspace_id // empty')
ACCEPT_SUCCESS=$(echo "$ACCEPT_RESPONSE" | jq -r '.success // false')

if [ "$ACCEPT_SUCCESS" != "true" ]; then
  echo "❌ Failed to accept invite"
  exit 1
fi

echo "✅ Invite accepted"
echo "   Employee workspace_id: $WORKSPACE_ID"
echo ""

# Step 3: Login as employee
echo "3️⃣  Logging in as employee..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")

echo "Login response: $LOGIN_RESPONSE"
SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session.access_token // empty')

if [ -z "$SESSION_TOKEN" ]; then
  echo "❌ Failed to login"
  exit 1
fi

echo "✅ Login successful"
echo ""

# Step 4: Check auth/me endpoint
echo "4️⃣  Checking /api/auth/me (employee role resolution)..."
AUTH_ME=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $SESSION_TOKEN")

echo "Auth Me response: $AUTH_ME"
AUTH_ROLE=$(echo "$AUTH_ME" | jq -r '.role // empty')
AUTH_WORKSPACE=$(echo "$AUTH_ME" | jq -r '.workspaceId // empty')
AUTH_STATUS=$(echo "$AUTH_ME" | jq -r '.user.role // empty')

echo ""
echo "📊 RESULTS:"
echo "   Role: $AUTH_ROLE (expected: employee)"
echo "   Workspace ID: $AUTH_WORKSPACE"
echo "   User role: $AUTH_STATUS"
echo ""

if [ "$AUTH_ROLE" != "employee" ]; then
  echo "❌ FAILED: Role not resolved as 'employee'"
  exit 1
fi

if [ "$AUTH_WORKSPACE" = "null" ] || [ -z "$AUTH_WORKSPACE" ]; then
  echo "❌ FAILED: Workspace ID is null (should be PLATFORM_WORKSPACE_ID)"
  exit 1
fi

if [ "$AUTH_WORKSPACE" != "$WORKSPACE_ID" ]; then
  echo "⚠️  WARNING: Auth workspace differs from invite workspace"
  echo "   Invite workspace: $WORKSPACE_ID"
  echo "   Auth workspace: $AUTH_WORKSPACE"
fi

echo ""
echo "================================================"
echo "✅ ALL TESTS PASSED"
echo "================================================"
echo ""
echo "Employee can now:"
echo "  - Access /employees/dashboard"
echo "  - Use workspace: $AUTH_WORKSPACE"
echo "  - Role: $AUTH_ROLE"

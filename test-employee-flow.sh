#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test data
TIMESTAMP=$(date +%s)
TEST_EMAIL="employee-test-${TIMESTAMP}@demo.com"
TEST_PASSWORD="TestPassword123!"
SUPER_ADMIN_TOKEN="YOUR_SUPER_ADMIN_TOKEN_HERE"
BASE_URL="http://localhost:3000"

echo -e "${YELLOW}=== Employee Invite Flow Test ===${NC}"
echo "Email: $TEST_EMAIL"
echo ""

# Step 1: Super admin invites employee
echo -e "${YELLOW}Step 1: Super admin invites employee...${NC}"
INVITE_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/platform-employees" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\"}")

echo "$INVITE_RESPONSE" | jq .

INVITE_TOKEN=$(echo "$INVITE_RESPONSE" | jq -r '.token // empty')

if [ -z "$INVITE_TOKEN" ]; then
  echo -e "${RED}✗ Failed to get invite token${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Invite created with token: ${INVITE_TOKEN:0:10}...${NC}"
echo ""

# Step 2: Accept invite
echo -e "${YELLOW}Step 2: Employee accepts invite...${NC}"
ACCEPT_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/employees/accept-invite?token=$INVITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"first_name\": \"Test\", \"password\": \"$TEST_PASSWORD\"}")

echo "$ACCEPT_RESPONSE" | jq .

WORKSPACE_ID=$(echo "$ACCEPT_RESPONSE" | jq -r '.workspace_id // empty')
AUTH_UID=$(echo "$ACCEPT_RESPONSE" | jq -r '.auth_uid // empty')

if [ -z "$WORKSPACE_ID" ] || [ "$WORKSPACE_ID" = "null" ]; then
  echo -e "${RED}✗ Workspace ID is null! Should be PLATFORM_WORKSPACE_ID${NC}"
  exit 1
fi

if [ "$WORKSPACE_ID" != "00000000-0000-0000-0000-000000000001" ]; then
  echo -e "${RED}✗ Workspace ID is not PLATFORM_WORKSPACE_ID: $WORKSPACE_ID${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Invite accepted! Workspace ID: $WORKSPACE_ID${NC}"
echo ""

# Step 3: Employee logs in
echo -e "${YELLOW}Step 3: Employee logs in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST \
  "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"$TEST_EMAIL\", \"password\": \"$TEST_PASSWORD\"}")

echo "$LOGIN_RESPONSE" | jq .

LOGIN_STATUS=$(echo "$LOGIN_RESPONSE" | jq -r '.status // empty')

if [ "$LOGIN_STATUS" != "success" ]; then
  echo -e "${RED}✗ Login failed${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Login successful!${NC}"
echo ""

# Step 4: Check /api/auth/me
echo -e "${YELLOW}Step 4: Verify auth/me returns correct workspace...${NC}"
AUTH_ME_RESPONSE=$(curl -s -X GET \
  "$BASE_URL/api/auth/me" \
  -H "Cookie: sb-ftqcfpxundnxyvnaalia-auth-token=$(echo "$LOGIN_RESPONSE" | jq -r '.session.access_token // empty')")

echo "$AUTH_ME_RESPONSE" | jq .

ME_ROLE=$(echo "$AUTH_ME_RESPONSE" | jq -r '.role // empty')
ME_WORKSPACE=$(echo "$AUTH_ME_RESPONSE" | jq -r '.workspaceId // empty')

if [ "$ME_ROLE" != "employee" ]; then
  echo -e "${RED}✗ Role is not 'employee': $ME_ROLE${NC}"
  exit 1
fi

if [ "$ME_WORKSPACE" != "00000000-0000-0000-0000-000000000001" ]; then
  echo -e "${RED}✗ Workspace ID is not PLATFORM_WORKSPACE_ID: $ME_WORKSPACE${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Auth/me returns correct role and workspace!${NC}"
echo ""

echo -e "${GREEN}=== ✓ All tests passed! ===${NC}"

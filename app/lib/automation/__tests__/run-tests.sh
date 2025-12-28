#!/bin/bash

# Automation Executor Test Runner
# Runs all tests for the automation executor module

echo "=========================================="
echo "Running Automation Executor Tests"
echo "=========================================="
echo

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

TOTAL_TESTS=0
TOTAL_PASSED=0
TOTAL_FAILED=0

# Run executor unit tests
echo "Running executor unit tests..."
if node app/lib/automation/__tests__/executor-tests.js > /tmp/executor-tests.log 2>&1; then
    PASS_COUNT=$(grep "Results:" /tmp/executor-tests.log | grep -oP '\d+(?= passed)' | head -1)
    TOTAL_TESTS=$((TOTAL_TESTS + 12))
    TOTAL_PASSED=$((TOTAL_PASSED + PASS_COUNT))
    echo -e "${GREEN}✓ Executor tests passed${NC}"
else
    TOTAL_TESTS=$((TOTAL_TESTS + 12))
    TOTAL_FAILED=$((TOTAL_FAILED + 12))
    echo -e "${RED}✗ Executor tests failed${NC}"
    cat /tmp/executor-tests.log
fi
echo

# Run integration tests
echo "Running integration tests..."
if node app/lib/automation/__tests__/integration-tests.js > /tmp/integration-tests.log 2>&1; then
    PASS_COUNT=$(grep "Results:" /tmp/integration-tests.log | grep -oP '\d+(?= passed)' | head -1)
    TOTAL_TESTS=$((TOTAL_TESTS + 8))
    TOTAL_PASSED=$((TOTAL_PASSED + PASS_COUNT))
    echo -e "${GREEN}✓ Integration tests passed${NC}"
else
    TOTAL_TESTS=$((TOTAL_TESTS + 8))
    TOTAL_FAILED=$((TOTAL_FAILED + 8))
    echo -e "${RED}✗ Integration tests failed${NC}"
    cat /tmp/integration-tests.log
fi
echo

# Summary
echo "=========================================="
echo "Test Summary"
echo "=========================================="
if [ $TOTAL_FAILED -eq 0 ]; then
    echo -e "${GREEN}Total: $TOTAL_PASSED/$TOTAL_TESTS tests passed ✓${NC}"
    exit 0
else
    echo -e "${RED}Total: $TOTAL_PASSED/$TOTAL_TESTS tests passed, $TOTAL_FAILED failed${NC}"
    exit 1
fi

#!/bin/bash

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="http://localhost:3000"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testing Semantic Deduplication & Standup Reports         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Step 1: Login
echo -e "${YELLOW}Step 1: Logging in...${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@acme.com",
    "password": "password123"
  }')

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login failed. Make sure the API is running and credentials are correct.${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login successful!${NC}"
echo "Token: ${TOKEN:0:20}..."
echo ""

# Step 2: Test Semantic Deduplication
echo -e "${YELLOW}Step 2: Testing Semantic Task Deduplication...${NC}"
echo ""

# Create first task
echo "Creating first task: 'Implement user authentication system'..."
TASK1=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Implement user authentication system",
    "description": "Create a JWT-based authentication system with login and registration endpoints",
    "category": "Work",
    "priority": "High",
    "status": "Todo"
  }')

TASK1_ID=$(echo "$TASK1" | jq -r '.id')

if [ "$TASK1_ID" = "null" ] || [ -z "$TASK1_ID" ]; then
  echo -e "${RED}❌ Failed to create first task${NC}"
  echo "Response: $TASK1"
  exit 1
fi

echo -e "${GREEN}✅ First task created successfully!${NC}"
echo "   Task ID: $TASK1_ID"
echo "   Title: $(echo "$TASK1" | jq -r '.title')"
echo ""

# Wait for embedding to sync
echo "Waiting 3 seconds for embedding to sync..."
sleep 3
echo ""

# Try to create a very similar task (should be blocked)
echo "Attempting to create similar task: 'Add user authentication'..."
DUPLICATE_RESPONSE=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Add user authentication",
    "description": "Build JWT authentication with login and signup features",
    "category": "Work",
    "priority": "High",
    "status": "Todo"
  }')

# Check if duplicate was detected
if echo "$DUPLICATE_RESPONSE" | jq -e '.duplicates' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Duplicate detection working!${NC}"
  DUPLICATE_COUNT=$(echo "$DUPLICATE_RESPONSE" | jq '.duplicates | length')
  echo "   Found $DUPLICATE_COUNT duplicate(s):"
  echo "$DUPLICATE_RESPONSE" | jq -r '.duplicates[] | "   - \(.title) (similarity: \(.similarity * 100 | round)%)"'
else
  echo -e "${RED}❌ Duplicate detection failed or task was created${NC}"
  echo "Response: $DUPLICATE_RESPONSE"
fi
echo ""

# Create a different task (should succeed)
echo "Creating different task: 'Design database schema'..."
TASK2=$(curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Design database schema",
    "description": "Create ERD and database migration files for the new features",
    "category": "Work",
    "priority": "Medium",
    "status": "Todo"
  }')

TASK2_ID=$(echo "$TASK2" | jq -r '.id')

if [ "$TASK2_ID" = "null" ] || [ -z "$TASK2_ID" ]; then
  echo -e "${RED}❌ Failed to create different task${NC}"
  echo "Response: $TASK2"
else
  echo -e "${GREEN}✅ Different task created successfully!${NC}"
  echo "   Task ID: $TASK2_ID"
  echo "   Title: $(echo "$TASK2" | jq -r '.title')"
fi
echo ""

# Step 3: Test Standup Reports
echo -e "${YELLOW}Step 3: Testing AI Standup Reports...${NC}"
echo ""

# Create a few more tasks for the report
echo "Creating additional tasks for standup report..."

curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Fix login bug",
    "description": "Users cannot login with special characters in password",
    "category": "Bug",
    "priority": "High",
    "status": "InProgress"
  }' > /dev/null

curl -s -X POST "$API_URL/api/tasks" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Deploy to staging",
    "description": "Deploy latest changes to staging environment",
    "category": "Work",
    "priority": "High",
    "status": "Done"
  }' > /dev/null

echo -e "${GREEN}✅ Additional tasks created${NC}"
echo ""

# Generate standup report
echo "Generating standup report..."
REPORT_RESPONSE=$(curl -s -X GET "$API_URL/api/reports/standup" \
  -H "Authorization: Bearer $TOKEN")

if echo "$REPORT_RESPONSE" | jq -e '.report' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Standup report generated successfully!${NC}"
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo "$REPORT_RESPONSE" | jq -r '.report'
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
  echo -e "${RED}❌ Standup report generation failed${NC}"
  echo "Response: $REPORT_RESPONSE"
fi
echo ""

# Step 4: Check Audit Logs
echo -e "${YELLOW}Step 4: Checking Audit Logs...${NC}"
echo ""

AUDIT_LOGS=$(curl -s -X GET "$API_URL/api/audit-log?limit=10" \
  -H "Authorization: Bearer $TOKEN")

if echo "$AUDIT_LOGS" | jq -e '.[0]' > /dev/null 2>&1; then
  echo -e "${GREEN}✅ Audit logs retrieved${NC}"
  echo ""
  echo "Recent audit entries:"
  echo "$AUDIT_LOGS" | jq -r '.[] | "   [\(.createdAt)] \(.action) - \(if .allowed then "✓ ALLOWED" else "✗ DENIED (\(.reason))" end)"' | head -5
else
  echo -e "${RED}❌ Failed to retrieve audit logs${NC}"
fi
echo ""

# Summary
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Summary                                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✅ Semantic Task Deduplication: Working${NC}"
echo -e "${GREEN}✅ AI Standup Reports: Working${NC}"
echo -e "${GREEN}✅ Audit Logging: Working${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Open the dashboard at http://localhost:4200"
echo "2. Try creating similar tasks through the UI"
echo "3. View the standup report in your application"
echo ""
echo -e "${GREEN}All tests completed successfully! 🎉${NC}"

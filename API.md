# Retail Assist App - API Documentation

**Base URL:** `https://retail-assist-app.netlify.app` (Production) or `http://localhost:5000` (Dev)

---

## Authentication

### Session-Based Authentication
Used for dashboard and authenticated requests:

```bash
curl -X GET http://localhost:5000/api/agents \
  -H "Cookie: sb-auth-token=your_session_token"
```

The session is managed by Supabase Auth and stored in:
- `localStorage` (browser)
- Cookies (sent with requests)

### API Key Authentication
Used for public API access:

```bash
curl -X POST http://localhost:5000/api/agent/AGENT_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_your_api_key_here" \
  -d '{"message": "Hello"}'
```

Each agent has a unique API key that can be shared with external applications.

---

## Agents

### List Agents

```http
GET /api/agents
```

**Authentication:** Session-based (requires login)

**Response:**
```json
{
  "agents": [
    {
      "id": "uuid",
      "workspace_id": "uuid",
      "name": "Sales Assistant",
      "description": "Helps with product inquiries",
      "system_prompt": "You are a helpful sales rep...",
      "greeting": "Hello! How can I help?",
      "fallback": "I'm not sure, let me connect you...",
      "model": "gpt-4o-mini",
      "temperature": 0.7,
      "max_tokens": 500,
      "api_key": "sk_...",
      "enabled": true,
      "created_at": "2025-12-07T10:00:00Z",
      "updated_at": "2025-12-07T10:00:00Z"
    }
  ]
}
```

---

### Create Agent

```http
POST /api/agents
Content-Type: application/json
```

**Authentication:** Session-based (requires login)

**Request Body:**
```json
{
  "name": "Customer Support Bot",
  "description": "Handles customer inquiries",
  "systemPrompt": "You are a helpful customer support agent...",
  "greeting": "Welcome! How can we help?",
  "fallback": "I'll connect you with a human agent.",
  "model": "gpt-4o-mini",
  "workspaceId": "uuid" // Optional, uses default workspace if not provided
}
```

**Response (201 Created):**
```json
{
  "agent": {
    "id": "agent_123",
    "workspace_id": "workspace_123",
    "name": "Customer Support Bot",
    "api_key": "sk_abc123def456...",
    "created_at": "2025-12-07T10:05:00Z"
  }
}
```

**Errors:**
- `400 Bad Request` - Missing required fields
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - No access to workspace
- `500 Server Error` - Database error

---

## Agent Conversation

### Send Message to Agent

```http
POST /api/agent/{agentId}
Content-Type: application/json
```

**Authentication:** Session-based OR API key (header)

**Request Body:**
```json
{
  "message": "What are your product features?"
}
```

**Request Headers (for API key auth):**
```
X-API-Key: sk_your_api_key_here
```

**Response:**
```json
{
  "reply": "Our product offers...",
  "tokens_used": 145,
  "cost": 0.00234
}
```

**Response Codes:**
- `200 OK` - Message processed successfully
- `400 Bad Request` - Missing message
- `401 Unauthorized` - Invalid API key or not logged in
- `403 Forbidden` - Agent is disabled
- `404 Not Found` - Agent not found
- `500 Server Error` - OpenAI error

---

## Comments & Public Feedback

### Submit Comment

```http
POST /api/agent/{agentId}/comments
Content-Type: application/json
```

**Authentication:** None required (public endpoint)

**Request Body:**
```json
{
  "content": "Great product, really helped my business!",
  "author_email": "customer@example.com"
}
```

**Response:**
```json
{
  "reply": "Thank you for the feedback! We're glad we could help."
}
```

**Behavior:**
1. Comment is saved to database
2. OpenAI generates a bot reply
3. Reply is sent as DM to commenter's email
4. Comment is marked as processed

---

## Webhooks

### Meta/Facebook Webhook

Complete webhook integration for receiving Facebook comments, messages, and events.

**Endpoint:** `POST /api/webhooks/facebook`

#### Webhook Verification (GET Request)

Meta sends a GET request to verify your webhook during setup:

```http
GET /api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=CHALLENGE_STRING
```

**Parameters:**
- `hub.mode` - Should be "subscribe"
- `hub.verify_token` - Must match META_VERIFY_TOKEN in environment
- `hub.challenge` - Random string to echo back

**Successful Response:**
```
Status: 200 OK
Body: CHALLENGE_STRING (the value from hub.challenge parameter)
```

**Failed Response:**
```
Status: 403 Forbidden
```

#### Receiving Events (POST Request)

Meta sends event payloads to your webhook when comments or messages occur on your page.

**Headers:**
```
Content-Type: application/json
X-Hub-Signature-256: sha256=SIGNATURE_HASH
```

**Example: Page Comment Event**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "123456789",
      "time": 1512212425,
      "changes": [
        {
          "field": "feed",
          "value": {
            "item": "comment",
            "id": "post_123_comment_456",
            "message": "This product looks amazing!",
            "from": {
              "name": "John Doe",
              "id": "user_789"
            },
            "object_id": "post_123",
            "post_id": "123_456",
            "created_time": "2024-01-01T12:00:00+0000",
            "permalink_url": "https://www.facebook.com/page/posts/123?comment_id=456"
          }
        }
      ]
    }
  ]
}
```

**Example: Inbox Message Event**

```json
{
  "object": "page",
  "entry": [
    {
      "id": "123456789",
      "time": 1512212425,
      "messaging": [
        {
          "sender": {
            "id": "user_123",
            "name": "Jane Smith"
          },
          "recipient": {
            "id": "123456789"
          },
          "timestamp": 1512212425,
          "message": {
            "mid": "msg_abc123",
            "text": "Hello, do you have this in size M?"
          }
        }
      ]
    }
  ]
}
```

**Response (Webhook Handler):**

Your endpoint should return 200 OK immediately (within 20 seconds):

```json
{
  "ok": true,
  "processed": 1,
  "total": 1
}
```

**Processing Flow:**

1. **Verify Signature** - Validates webhook authenticity
2. **Parse Event** - Detects comment vs. message
3. **Find Workspace** - Matches page ID to workspace
4. **Load Rules** - Gets automation rules for workspace
5. **Generate Response** - Uses OpenAI to create intelligent reply
6. **Send Reply** - Posts reply to Facebook (if enabled)
7. **Send DM** - Sends private message (if enabled)
8. **Mark Processed** - Records in database to prevent duplicates

**Webhook Subscription Topics:**

Subscribe to these topics in Meta App Dashboard to receive events:

- **`feed`** - Receive comment events on posts
- **`messages`** - Receive inbox messages (DMs)
- **`standby`** - Get standby notifications

**Event Types Handled:**

| Event | Trigger | Action |
|-------|---------|--------|
| Comment | New comment on post | Reply publicly + send DM |
| Message | New DM received | Reply with DM |
| Comment Edit | Comment edited | Update or ignore |
| Comment Reply | Reply to existing reply | Can skip with auto_skip_replies |

**Testing Your Webhook:**

```bash
# Use Meta Webhook Simulator in App Dashboard
# Or test locally with ngrok:

ngrok http 5000
# Update webhook URL to: https://xxxxx.ngrok.io/api/webhooks/facebook

# Test with curl:
curl -X POST http://localhost:5000/api/webhooks/facebook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "page",
    "entry": [{
      "id": "123456789",
      "changes": [{
        "field": "feed",
        "value": {
          "item": "comment",
          "id": "test_comment",
          "message": "Test comment",
          "from": {"id": "user1", "name": "Test User"},
          "post_id": "123_456",
          "created_time": "2024-01-01T12:00:00Z"
        }
      }]
    }]
  }'
```

**Error Handling:**

```json
{
  "ok": false,
  "error": "Workspace not found",
  "status": 404
}
```

**Rate Limits:**

- Meta sends webhooks in real-time
- Your endpoint should respond within 20 seconds
- Implement request queuing for high volume
- Use database for deduplication (already implemented)

---

## Comment Automation

### Process Comment

Sends a comment through the automation engine. If it matches any enabled rules, AI-generated replies are automatically created and sent.

```http
POST /api/automation/comment
Content-Type: application/json
```

**Request Parameters:**
- `postId` (string, required): ID of the post being commented on
- `commentId` (string, required): ID of the comment
- `commentText` (string, required): The comment content
- `authorId` (string, optional): ID of comment author on platform
- `authorName` (string, optional): Name of comment author
- `userId` (string, optional): Internal user ID
- `workspaceId` (string, required): Workspace to process for
- `platform` (string, required): `"facebook"` or `"instagram"`
- `pageAccessToken` (string, optional): Meta API access token for sending replies

**Request Example:**
```json
{
  "postId": "123_456",
  "commentId": "456_789",
  "commentText": "When will this item ship?",
  "authorId": "789_123",
  "authorName": "Jane Smith",
  "workspaceId": "workspace_uuid",
  "platform": "facebook",
  "pageAccessToken": "EAAR...xxx"
}
```

**Response (200 OK):**
```json
{
  "status": "ok",
  "replied": true,
  "sentDM": false,
  "message": "Automation completed successfully"
}
```

**Response Fields:**
- `status`: `"ok"` if no error, `"error"` if request failed
- `replied`: `true` if a public reply was sent
- `sentDM`: `true` if a private message was sent
- `message`: Human-readable status message

**How It Works:**
1. Comment is stored in database
2. System checks if comment was already processed (prevents duplicates)
3. Enabled automation rules are checked against comment content & platform
4. For matching rules:
   - AI generates a personalized public reply using agent knowledge
   - AI generates a personalized DM using agent knowledge
   - Both are sent to respective channels (if enabled in rule)
5. Action is logged for analytics

---

## Error Handling

All endpoints follow this error response format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - 401 Not authenticated
- `FORBIDDEN` - 403 Access denied
- `NOT_FOUND` - 404 Resource not found
- `VALIDATION_ERROR` - 400 Invalid input
- `DATABASE_ERROR` - 500 Database issue
- `OPENAI_ERROR` - 500 OpenAI API error

---

## Rate Limiting

**Current:** No rate limiting (add before production)

**Recommended Limits:**
- Per IP: 100 requests/minute
- Per API Key: 1000 requests/minute
- Per User: 10,000 requests/day

---

## Pagination

Not currently implemented. Add for large result sets:

```http
GET /api/agents?page=1&limit=20
```

---

## Data Types

### Agent
```typescript
{
  id: string;                 // UUID
  workspace_id: string;       // UUID
  name: string;              // Agent name
  description?: string;      // Optional description
  system_prompt: string;     // OpenAI system prompt
  greeting?: string;         // Initial greeting message
  fallback?: string;         // Response if error occurs
  model: string;             // gpt-4o-mini, gpt-4o, gpt-3.5-turbo
  temperature: number;       // 0.0 - 2.0 (randomness)
  max_tokens: number;        // Max response length
  api_key: string;          // Unique API key (sk_...)
  enabled: boolean;         // Whether agent is active
  created_at: string;       // ISO 8601 timestamp
  updated_at: string;       // ISO 8601 timestamp
  deleted_at?: string;      // Soft delete timestamp
}
```

### Comment
```typescript
{
  id: string;                    // UUID
  agent_id: string;              // UUID
  platform: string;              // facebook, instagram, website, whatsapp
  author_email?: string;         // Commenter's email
  author_name?: string;          // Commenter's name
  content: string;               // Comment text
  platform_comment_id?: string;  // External comment ID
  processed: boolean;            // Whether bot replied
  processed_at?: string;         // When reply was sent
  bot_reply?: string;            // Bot's response
  created_at: string;            // ISO 8601 timestamp
}
```

### DirectMessage
```typescript
{
  id: string;              // UUID
  workspace_id: string;    // UUID
  agent_id: string;        // UUID
  recipient_id: string;    // Email or external user ID
  recipient_name?: string; // Name (if available)
  sender_display: string;  // Display name in message
  content: string;         // Message content
  platform: string;        // email, facebook_messenger, whatsapp, instagram_dm
  status: string;          // sent, failed, read, replied
  created_at: string;      // ISO 8601 timestamp
}
```

---

## Examples

### Create an Agent & Get API Key

```bash
# Login (you'll get a session cookie)
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }' \
  -c cookies.txt

# Create agent
curl -X POST http://localhost:5000/api/agents \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "name": "My First Agent",
    "systemPrompt": "You are a helpful assistant.",
    "greeting": "Hello! How can I help?"
  }' | jq .agent.api_key
# Output: sk_abc123def456...
```

### Use Agent API Key

```bash
# Store the API key
API_KEY="sk_abc123def456..."
AGENT_ID="agent_123"

# Send message
curl -X POST http://localhost:5000/api/agent/$AGENT_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"message": "What can you help with?"}'

# Response:
# {
#   "reply": "I can help you with...",
#   "tokens_used": 45,
#   "cost": 0.00067
# }
```

### Submit a Comment

```bash
curl -X POST http://localhost:5000/api/agent/agent_123/comments \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This product is amazing!",
    "author_email": "customer@example.com"
  }'

# Response:
# {
#   "reply": "Thank you for the positive feedback!"
# }
```

---

## Webhooks Setup

### Meta/Facebook

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create app or go to existing app
3. Add product: "Webhooks"
4. Configure webhook:
   - **Callback URL:** `https://your-domain.com/api/webhooks/facebook`
   - **Verify Token:** Random string (save to `META_VERIFY_TOKEN`)
   - **Subscribe to:** `feed` (for comments)

5. Set environment variables:
```bash
META_VERIFY_TOKEN=your_random_token
META_PAGE_ACCESS_TOKEN=your_page_token
```

6. Test webhook:
```bash
curl -X GET "http://localhost:5000/api/webhooks/facebook?hub.mode=subscribe&hub.verify_token=your_random_token&hub.challenge=test_challenge"
```

---

## Cost Tracking

Each API call is tracked for cost:

```json
{
  "reply": "...",
  "tokens_used": 145,
  "cost": 0.00234
}
```

**Costs tracked in database:**
- Per message in `message_logs` table
- Daily aggregation in `daily_stats` table
- Subscription pricing based on usage

---

## Payments (Feature 9)

### PayPal Checkout

#### Create PayPal Order

```http
POST /api/payments/paypal/create
Content-Type: application/json
Cookie: sb-auth-token=<session_token>

{
  "amount": 29.99,
  "currency": "USD",
  "workspaceId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "abc123",
  "approvalUrl": "https://sandbox.paypal.com/checkoutnow?token=abc123",
  "paymentId": "payment-uuid"
}
```

**Errors:**
- 401: Unauthorized
- 400: Missing fields
- 403: Not a workspace member
- 500: PayPal API error

#### Capture PayPal Order

```http
POST /api/payments/paypal/capture
Content-Type: application/json
Cookie: sb-auth-token=<session_token>

{
  "orderId": "abc123",
  "paymentId": "payment-uuid"
}
```

**Response:**
```json
{
  "success": true,
  "captureId": "capture-123",
  "status": "COMPLETED",
  "amount": "29.99"
}
```

### Mobile Money Payments

#### Initiate Mobile Money Payment

```http
POST /api/payments/mobile-money/initiate
Content-Type: application/json
Cookie: sb-auth-token=<session_token>

{
  "amount": 150.00,
  "phoneNumber": "+267 71 234 567",
  "workspaceId": "uuid",
  "currency": "BWP"
}
```

**Response:**
```json
{
  "success": true,
  "referenceCode": "MM-ABC123-XYZ99",
  "paymentId": "payment-uuid",
  "message": "Please send 150.00 BWP to... Reference: MM-ABC123-XYZ99"
}
```

#### Approve Mobile Money Payment (Admin)

```http
POST /api/payments/mobile-money/admin/approve
Content-Type: application/json
Cookie: sb-auth-token=<admin_token>

{
  "paymentId": "payment-uuid",
  "notes": "Payment received and verified"
}
```

**Requirements:**
- User must be admin/owner of workspace
- Payment must be in pending status

**Response:**
```json
{
  "success": true,
  "paymentId": "payment-uuid",
  "status": "approved"
}
```

#### Reject Mobile Money Payment (Admin)

```http
POST /api/payments/mobile-money/admin/reject
Content-Type: application/json
Cookie: sb-auth-token=<admin_token>

{
  "paymentId": "payment-uuid",
  "reason": "Invalid reference code provided"
}
```

**Response:**
```json
{
  "success": true,
  "paymentId": "payment-uuid",
  "status": "rejected"
}
```

### PayPal Webhooks

#### Webhook Endpoint

```http
POST /api/webhooks/paypal
Content-Type: application/json

<PayPal webhook payload>
```

**PayPal Headers (required):**
- `paypal-transmission-id`
- `paypal-transmission-time`
- `paypal-transmission-sig`
- `paypal-cert-url`
- `paypal-auth-algo`

**Handled Events:**
- `CHECKOUT.ORDER.COMPLETED` - Order approved
- `CHECKOUT.ORDER.PROCESSED` - Order captured
- `BILLING.SUBSCRIPTION.CREATED` - Subscription created
- `BILLING.SUBSCRIPTION.ACTIVATED` - Subscription active
- `BILLING.SUBSCRIPTION.CANCELLED` - Subscription cancelled

**Response:**
```json
{ "success": true }
```

---

## Rate Limiting (Recommended)

Before production, implement rate limiting:

```typescript
// Per IP: 100 req/min
// Per API Key: 1000 req/min
// Per User: 10,000 req/day
```

Consider using [Upstash](https://upstash.com) or [Bull Queue](https://github.com/OptimalBits/bull) for rate limiting.

---

## Monitoring

Monitor these metrics:

- **API Response Time** - Should be <1s for agent responses
- **Error Rate** - Should be <1%
- **Token Usage** - Track daily costs
- **Concurrent Requests** - Plan for scale
- **Webhook Failures** - Check Facebook logs

---

## Versioning

**Current API Version:** v1 (2025-12)

No versioning in URLs yet. When introducing breaking changes, use:
- `/api/v2/agents` instead of `/api/agents`
- Support old version for 6+ months

---

## Changelog

### 2025-12-15 (Feature 9 - Payment Gateway)
- ✅ PayPal order checkout integration
- ✅ PayPal order capture & webhook verification
- ✅ Mobile Money payment initiation (MTN, Vodacom, Airtel)
- ✅ Admin approval/rejection workflow
- ✅ Payment history tracking
- ✅ Reference code generation
- ✅ Mock payment mode for local testing

### 2025-12-07
- ✅ Agents CRUD endpoints implemented
- ✅ OpenAI chat integration live
- ✅ Comment processing & DM sending
- ✅ API key authentication
- ✅ Cost tracking

### Coming Soon
- 🔄 Stripe integration
- 🔄 Rate limiting with Upstash
- 🔄 Request/response validation with Zod
- 🔄 Advanced analytics endpoints

---

## Support & Issues

- **Bugs:** GitHub Issues
- **Feature Requests:** GitHub Discussions  
- **Questions:** Email support@retailassist.app
- **Docs:** https://retailassist.app/docs

---

**Last Updated:** December 7, 2025

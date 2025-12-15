# Retail Assist App - Setup & Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18-20
- npm or yarn
- Supabase account
- OpenAI API key

### Local Development Setup

1. **Clone & Install**
```bash
git clone https://github.com/wisemanreal88-spec/retail-assist-app.git
cd retail-assist-app
npm install
```

2. **Configure Environment**
```bash
cp .env.example .env.local
```

3. **Setup Mock Mode (Fastest for Development)**
```bash
# .env.local
NEXT_PUBLIC_USE_MOCK_SUPABASE=true
NEXT_PUBLIC_TEST_MODE=true
```

4. **Run Development Server**
```bash
npm run dev
```

Visit `http://localhost:5000` - App works fully in mock mode!

---

## 📊 Database Setup (When Ready)

### Step 1: Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Copy credentials to `.env.local`:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

### Step 2: Apply Database Schema
Choose your preferred method:

#### Option A: Using Supabase CLI
```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Apply migration
supabase db push
```

#### Option B: Manual SQL in Supabase UI
1. Open Supabase dashboard > SQL Editor
2. Copy entire content from `supabase/migrations/001_initial_schema.sql`
3. Paste into SQL editor and execute

#### Option C: Using psql directly
```bash
psql postgresql://user:password@host:port/database < supabase/migrations/001_initial_schema.sql
```

### Step 3: Enable RLS Policies
The migration script includes all RLS policies. Verify in Supabase:
1. Go to Authentication > Policies
2. Confirm policies are active for all tables

### Step 4: Update Environment Variables
```bash
# .env.local
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
NEXT_PUBLIC_SUPABASE_URL=your-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key
```

### Step 5: Test Connection
```bash
npm run dev
# Go to /dashboard and sign up - should store in real Supabase
```

---

## 🤖 OpenAI Integration

### Setup Steps
1. Get API key from [platform.openai.com](https://platform.openai.com/account/api-keys)
2. Add to `.env.local`:
```bash
OPENAI_API_KEY=sk_your_key_here
```

3. Implementation in code:
```typescript
import { callOpenAIChat } from '@/lib/openai/server';

const response = await callOpenAIChat([
  { role: 'system', content: 'You are helpful assistant' },
  { role: 'user', content: 'Hello' }
], 'gpt-4o-mini');
```

---

## 🔗 Meta/Facebook Integration

### Complete Setup Instructions

#### Step 1: Create Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Click "My Apps" > "Create App"
3. Choose "Business" as app type
4. Fill in app details and create

#### Step 2: Add Products
1. In your app dashboard, click "+ Add Product"
2. Find and add:
   - **Webhooks** - for receiving events
   - **Instagram Graph API** - for Instagram support (optional)
   - **Messenger Platform** (optional)

#### Step 3: Create or Connect Facebook Page
1. If you don't have a page, create one at [facebook.com](https://facebook.com)
2. Get your **Page ID** (see how below)
3. Get your **Page Access Token**:
   - Go to Messenger > Get Started
   - Select your page
   - Copy the Page Access Token

#### Step 4: Setup Webhook
1. In your Meta App dashboard:
   - Go to **Products > Webhooks**
   - Set **Callback URL**: `https://your-domain.com/api/webhooks/facebook`
   - Set **Verify Token**: Create a random secure string
   - Subscribe to topic: `feed` (for comments)
   - Subscribe to topic: `messages` (for DMs)

2. Save credentials to `.env.local`:
```bash
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
META_PAGE_ACCESS_TOKEN=your_page_access_token
META_VERIFY_TOKEN=your_webhook_verification_token_from_step_1
FACEBOOK_GRAPH_API_VERSION=v19.0
```

#### Step 5: Add Page Subscription
1. In your Meta App, go to **Products > Webhooks**
2. Under **Select subscriptions**, add your page
3. Select events to subscribe to:
   - `feed` - Receive comment events
   - `messages` - Receive inbox messages

#### Step 6: Test Your Webhook
Once deployed:
1. Go to Dashboard > Integrations
2. Enter your Facebook Page ID
3. Click "Test Webhook" button
4. Should see ✓ success message

### Finding Your Page ID
- Go to [facebook.com](https://facebook.com)
- Open your Page
- Click "Settings" (bottom left)
- Select "Basic Information"
- Your Page ID is in "Page Details" section

### Testing Locally (with ngrok)
For testing webhook locally before deployment:
```bash
# Install ngrok
npm install -g ngrok

# Start ngrok (exposes localhost:5000 to internet)
ngrok http 5000

# Use ngrok URL as webhook callback:
# https://abc123.ngrok.io/api/webhooks/facebook
```

### Example Webhook Event (Comment)
```json
{
  "object": "page",
  "entry": [{
    "id": "123456789",
    "time": 1512212425,
    "changes": [{
      "field": "feed",
      "value": {
        "item": "comment",
        "id": "comment_123",
        "message": "Great post!",
        "from": {
          "id": "user_456",
          "name": "John Doe"
        },
        "created_time": "2024-01-01T12:00:00+0000"
      }
    }]
  }]
}
```

### Troubleshooting Facebook Integration

#### Webhook Not Receiving Events
- [ ] Verify webhook URL is publicly accessible (HTTPS)
- [ ] Check Verify Token matches in Meta App settings
- [ ] Ensure "feed" topic is subscribed
- [ ] Check Webhooks logs in Meta App dashboard
- [ ] Test with Meta Webhook Simulator

#### Comment Automation Not Triggering
- [ ] Create automation rule in Dashboard > Inbox Automation
- [ ] Enable the rule and set trigger keywords
- [ ] Test with mock comment first (Dashboard > Inbox Automation > Test)
- [ ] Check server logs for "[Facebook Webhook]" messages

#### Page Access Token Expired
- [ ] Page tokens expire after 60 days without use
- [ ] Get a new token: Messenger > Get Started > Select Page
- [ ] Update META_PAGE_ACCESS_TOKEN in environment

---

## 💬 WhatsApp Cloud API

### Setup Steps
1. Go to [WhatsApp Business Platform](https://business.facebook.com/wa)
2. Create Business Account
3. Get Business Account ID & Phone Number ID
4. Get API token from app settings
5. Add to `.env.local`:
```bash
WHATSAPP_BUSINESS_ACCOUNT_ID=your_account_id
WHATSAPP_PHONE_NUMBER_ID=your_phone_id
WHATSAPP_API_TOKEN=your_api_token
```

---

## 💳 PayPal Payment Gateway

### Feature 9: Payment Gateway Integration

Retail Assist supports two payment methods:
1. **PayPal** - Online payment platform
2. **Mobile Money** - MTN, Vodacom, Airtel (Botswana/Africa)

### PayPal Setup

#### Step 1: Create PayPal Business Account
1. Go to [developer.paypal.com](https://developer.paypal.com)
2. Sign up or login
3. Create Business Account

#### Step 2: Create OAuth Application
1. Go to Dashboard > Applications > Sandbox Applications
2. Create new application (or use default)
3. Copy the following credentials:
   - **Client ID**
   - **Secret**

#### Step 3: Setup Webhook
1. Go to Dashboard > Settings > Webhooks
2. Create webhook endpoint:
   - **Webhook URL**: `https://your-domain.com/api/webhooks/paypal`
   - **Events to subscribe**: 
     - CHECKOUT.ORDER.COMPLETED
     - CHECKOUT.ORDER.PROCESSED
     - BILLING.SUBSCRIPTION.CREATED
     - BILLING.SUBSCRIPTION.ACTIVATED
     - BILLING.SUBSCRIPTION.CANCELLED

3. Copy **Webhook ID** after creation

#### Step 4: Configure Environment Variables
```bash
# PayPal OAuth (from Step 2)
PAYPAL_CLIENT_ID=your_client_id
PAYPAL_CLIENT_SECRET=your_client_secret

# PayPal Webhook (from Step 3)
PAYPAL_WEBHOOK_ID=your_webhook_id

# PayPal Configuration
PAYPAL_MODE=sandbox              # sandbox or live
PAYPAL_API_BASE=https://api-m.sandbox.paypal.com  # Changes based on mode
```

#### Step 5: Test Payment Flow
1. Go to Dashboard > Pricing page
2. Select a plan
3. Choose PayPal payment method
4. Click "Pay with PayPal"
5. Complete mock purchase (in sandbox mode)

### Mobile Money Setup (Manual Verification)

Mobile Money payments use a manual approval workflow:

1. **User initiates payment** → Reference code generated
2. **User sends payment** via MTN/Vodacom/Airtel
3. **Admin receives notification** → Can approve/reject
4. **User confirmation** → Payment status updated

#### Configuration

```bash
# Mobile Money support email (for admin notifications)
MOBILE_MONEY_SUPPORT_EMAIL=payments@retailassist.com
```

#### Process Flow
- User fills phone number and amount
- System generates unique reference code (MM-TIMESTAMP-RANDOM)
- Admin receives payment notification email
- Admin reviews payment in Dashboard > Billing > Admin Approvals
- Admin approves or rejects with optional notes
- Payment status updated to user

### Testing Payments

#### In Mock Mode
```bash
NEXT_PUBLIC_USE_MOCK_PAYMENTS=true
```
- All payment API calls return simulated responses
- No actual transactions
- Great for UI/UX testing

#### In Sandbox Mode
```bash
NEXT_PUBLIC_USE_MOCK_PAYMENTS=false
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_secret
```
- Real PayPal API calls (sandbox environment)
- PayPal test account credentials required
- Mobile Money payments still mocked

#### In Production
```bash
NEXT_PUBLIC_USE_MOCK_PAYMENTS=false
PAYPAL_MODE=live
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_CLIENT_SECRET=your_live_secret
```
- Real payments charged to real accounts
- Requires live PayPal credentials
- Mobile Money requires real payment provider integration

### API Endpoints

#### Create PayPal Order
```
POST /api/payments/paypal/create
Body: { amount: number, currency: string, workspaceId: string }
Response: { success: boolean, orderId: string, approvalUrl: string }
```

#### Capture PayPal Order
```
POST /api/payments/paypal/capture
Body: { orderId: string, paymentId: string }
Response: { success: boolean, captureId: string, status: string }
```

#### Initiate Mobile Money Payment
```
POST /api/payments/mobile-money/initiate
Body: { amount: number, phoneNumber: string, workspaceId: string }
Response: { success: boolean, referenceCode: string }
```

#### Approve Mobile Money Payment (Admin)
```
POST /api/payments/mobile-money/admin/approve
Body: { paymentId: string, notes?: string }
Response: { success: boolean, paymentId: string }
```

#### Reject Mobile Money Payment (Admin)
```
POST /api/payments/mobile-money/admin/reject
Body: { paymentId: string, reason: string }
Response: { success: boolean, paymentId: string }
```

### Webhook Events

PayPal sends webhook events to `/api/webhooks/paypal` for:
- Order creation and approval
- Order capture (payment completion)
- Subscription lifecycle events

---

## 💳 Stripe Setup (Coming Soon)

### Basic Setup
1. Create Stripe account at [stripe.com](https://stripe.com)
2. Get API key from Dashboard > API Keys
3. Get webhook secret from Webhooks
4. Add to `.env.local`:
```bash
STRIPE_API_KEY=sk_live_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_secret
```

---

## 🌐 Deployment to Netlify

### Step 1: Connect Repository
1. Go to [netlify.com](https://netlify.com)
2. Click "New site from Git"
3. Connect GitHub account and select repository

### Step 2: Build Settings
Netlify should auto-detect:
- Build command: `npm run build`
- Publish directory: `.next`

### Step 3: Set Environment Variables
In Netlify Dashboard > Site settings > Build & deploy > Environment:

Add all variables from `.env.example`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
META_APP_ID=...
META_APP_SECRET=...
META_PAGE_ACCESS_TOKEN=...
META_VERIFY_TOKEN=...
WHATSAPP_API_TOKEN=...
STRIPE_API_KEY=...
STRIPE_WEBHOOK_SECRET=...
NODE_ENV=production
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
```

### Step 4: Deploy
Push to main branch - Netlify auto-deploys!

---

## 📝 Database Types

All database types are defined in `app/lib/types/database.ts`:

```typescript
import { User, Agent, Comment, DirectMessage, Subscription } from '@/lib/types/database';

// Use in your code for type safety
const agent: Agent = { id: '...', ... };
```

---

## 🧪 Testing in Different Modes

### Mock Mode
```bash
NEXT_PUBLIC_USE_MOCK_SUPABASE=true
NEXT_PUBLIC_TEST_MODE=true
```
- All data is fake/simulated
- No real API calls
- Perfect for UI development

### Real Mode
```bash
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
OPENAI_API_KEY=sk_...
```
- Real Supabase database
- Real OpenAI calls
- Costs $$$ for API usage

### Hybrid Mode (Recommended)
```bash
NEXT_PUBLIC_USE_MOCK_SUPABASE=false
OPENAI_API_KEY=sk_...
```
- Real database
- Mock OpenAI (for development)
- Modify `/app/lib/openai/server.ts` to use mock

---

## 🔐 Security Checklist

- [ ] Never commit `.env.local` (added to .gitignore)
- [ ] Never expose `SUPABASE_SERVICE_ROLE_KEY` to client
- [ ] Enable RLS on all Supabase tables
- [ ] Use environment variables for all secrets
- [ ] Rotate API keys regularly
- [ ] Enable CORS on Supabase for your domain
- [ ] Setup rate limiting on API routes
- [ ] Monitor API usage for unusual activity
- [ ] Use HTTPS in production
- [ ] Enable 2FA on all service accounts

---

## 🐛 Troubleshooting

### Supabase Connection Issues
```bash
# Test connection
curl https://your-project.supabase.co/rest/v1/

# Check service role key permissions
# Go to Supabase > SQL Editor and run:
SELECT * FROM information_schema.tables WHERE table_schema = 'public';
```

### OpenAI API Errors
```bash
# Check API key is valid
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"

# Check rate limits and usage
# Go to https://platform.openai.com/account/usage
```

### Webhook Not Receiving Events
```bash
# For Meta/Facebook
# 1. Check webhook callback URL is public
# 2. Verify verification token matches
# 3. Check Netlify logs for errors
# 4. Use Meta Webhook Simulator in App Dashboard

# Test locally with ngrok:
npm install -g ngrok
ngrok http 5000
# Use ngrok URL as webhook callback
```

---

## 📚 Architecture Overview

See `ARCHITECTURE.md` for:
- Database schema diagram
- API endpoint documentation
- Component structure
- Data flow diagrams

---

## 🚢 Production Deployment Checklist

- [ ] All environment variables set in production
- [ ] Database schema migrated
- [ ] RLS policies enabled
- [ ] OpenAI API configured
- [ ] Stripe webhooks configured
- [ ] Meta/Facebook webhooks configured
- [ ] CORS settings configured
- [ ] Rate limiting enabled
- [ ] Error logging setup
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place
- [ ] Database backups automated
- [ ] SSL certificate valid
- [ ] CDN configured (optional)
- [ ] Load testing completed

---

## 📞 Support & Resources

- [Supabase Docs](https://supabase.com/docs)
- [Next.js Docs](https://nextjs.org/docs)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [Meta Graph API](https://developers.facebook.com/docs/graph-api)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api)
- [Stripe Docs](https://stripe.com/docs)

---

Generated: December 2025
Last Updated: Production v1.0

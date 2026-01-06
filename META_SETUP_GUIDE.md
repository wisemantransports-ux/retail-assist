# Meta Integration Setup Guide
# Phase 2A - Environment & Meta App Setup

## Required Environment Variables

Add these to your `.env.local` file:

```bash
# Meta/Facebook Integration
META_APP_ID=your-facebook-app-id
META_APP_SECRET=your-facebook-app-secret
META_VERIFY_TOKEN=your-webhook-verify-token
META_PAGE_ACCESS_TOKEN=fallback-page-access-token
```

## Meta App Setup Steps

### 1. Create Facebook App
1. Go to [Facebook Developers Console](https://developers.facebook.com/apps/)
2. Click "Create App" → "Business" → "Yourself or your own business"
3. Choose "Business" app type
4. Fill in app details:
   - App name: "Retail Assist"
   - App contact email: your-email@example.com
   - Business account: Select/create your business

### 2. Configure Products
1. **Messenger**: Add the Messenger product
2. **Instagram Basic Display**: Add for Instagram integration
3. **Instagram Messaging**: Add for Instagram DMs (requires approval)

### 3. Webhooks Setup
1. In your app dashboard, go to "Webhooks"
2. Click "Add Callback URL"
3. Enter your webhook URL:
   ```
   https://yourdomain.com/api/webhooks/facebook
   ```
4. Enter Verify Token: `your-webhook-verify-token` (must match META_VERIFY_TOKEN env var)
5. Subscribe to these events:
   - `messages`
   - `messaging_postbacks`
   - `feed` (for comments)

### 4. Permissions & Review
For MVP testing, you can use "Test Users" or connect real pages in Development Mode.

For production, submit these permissions for review:
- `pages_messaging`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_messages`

### 5. Get App Credentials
1. **App ID**: Found in Settings → Basic
2. **App Secret**: Found in Settings → Basic (keep secret!)
3. **Verify Token**: Choose any string (e.g., "retail_assist_verify_2024")
4. **Page Access Token**: Generate from Graph API Explorer or page settings

## Testing Checklist

- [ ] Environment variables set in `.env.local`
- [ ] Facebook app created and configured
- [ ] Webhook URL configured in Developer Console
- [ ] Verify token matches environment variable
- [ ] Required events subscribed
- [ ] Test webhook delivery with sample data

## Webhook URLs for Different Environments

### Production
```
Facebook: https://yourdomain.com/api/webhooks/facebook
Instagram: https://yourdomain.com/api/webhooks/instagram
```

### Development/Local
```
Facebook: http://localhost:3000/api/webhooks/facebook
Instagram: http://localhost:3000/api/webhooks/instagram
```

Note: Facebook requires HTTPS for production webhooks. Use ngrok or similar for local testing.

## Troubleshooting

### Webhook Verification Fails
- Check that META_VERIFY_TOKEN matches exactly
- Ensure webhook URL is accessible
- Verify app is not in Development Mode (may require HTTPS)

### OAuth Errors
- Check META_APP_ID and META_APP_SECRET are correct
- Verify app has proper permissions configured
- Ensure redirect URI matches: `https://yourdomain.com/api/meta/callback`

### Message Delivery Issues
- Confirm page access tokens are valid
- Check that webhooks are subscribed to correct events
- Verify app has necessary permissions approved
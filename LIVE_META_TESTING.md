# Phase 2A.1 - Live Meta App Testing Instructions
# Execute These Steps in Meta Developers Console

## Prerequisites
- ✅ Meta Developer Account (create at https://developers.facebook.com/)
- ✅ Business Account in Meta Business Manager
- ✅ HTTPS Domain (required for webhooks)
- ✅ Facebook Page to connect

## Step 1: Create Facebook App

1. **Navigate to Meta Developers Console**
   - Go to: https://developers.facebook.com/apps/
   - Click "Create App"

2. **App Configuration**
   - **App Type**: Business
   - **App Name**: Retail Assist (or your preferred name)
   - **App Contact Email**: your-email@example.com
   - **Business Account**: Select/create your business account

3. **Add Products**
   - **Messenger**: Click "Set Up" to add Messenger product
   - **Instagram Basic Display**: Click "Set Up" for Instagram integration

## Step 2: Configure Webhooks

1. **Access Webhooks**
   - In your app dashboard, find "Webhooks" in the left sidebar
   - Click "Add Callback URL"

2. **Webhook Configuration**
   ```
   Callback URL: https://yourdomain.com/api/webhooks/facebook
   Verify Token: retail_assist_verify_2024
   ```

3. **Subscribe to Events**
   - **messages**: For Messenger direct messages
   - **messaging_postbacks**: For button clicks and postbacks
   - **feed**: For post comments

4. **Verify Webhook**
   - Meta will send a verification request to your endpoint
   - Should return the challenge token automatically

## Step 3: App Review (Development Mode Only)

**For MVP Testing**: Stay in Development Mode (no review needed)
**For Production**: Submit these permissions for review:
- `pages_messaging`
- `pages_manage_metadata`
- `instagram_basic`
- `instagram_manage_messages`

## Step 4: Get App Credentials

1. **App Settings → Basic**
   - **App ID**: Copy this value
   - **App Secret**: Copy this value (keep secret!)

2. **Graph API Explorer**
   - Generate a **Page Access Token** for testing
   - Select your Facebook Page
   - Generate token with required permissions

## Step 5: Update Environment Variables

Update your production `.env.local` or environment:

```bash
META_APP_ID=your_actual_app_id_here
META_APP_SECRET=your_actual_app_secret_here
META_VERIFY_TOKEN=retail_assist_verify_2024
META_PAGE_ACCESS_TOKEN=your_page_access_token_here
```

## Step 6: Test OAuth Flow

1. **Access Dashboard**
   - Go to your app's `/dashboard/integrations` page
   - Click "Connect Facebook"

2. **OAuth Flow**
   - Should redirect to Meta login
   - Grant permissions for your pages
   - Redirect back to select pages to connect

3. **Page Connection**
   - Select Facebook pages to connect
   - Should store tokens and enable messaging

## Step 7: Live Message Testing

### Test Facebook Messenger
1. **Send DM to Page**
   - Message your connected Facebook Page
   - Check dashboard inbox for new message
   - Verify platform label shows "facebook"

2. **Test Automation**
   - Send message matching a rule (if rules exist)
   - Should trigger automation or AI response
   - Reply should appear in Messenger

3. **Test Comments**
   - Comment on a post from connected page
   - Should appear in inbox with "facebook" label
   - Test comment-to-DM feature (if enabled)

### Test Instagram (if configured)
1. **Send DM to Instagram Business Account**
   - Message your connected Instagram account
   - Should appear in dashboard inbox
   - Platform label should show "instagram"

## Step 8: Validation Checklist

### Webhook Delivery ✅
- [ ] Webhook verification successful
- [ ] Test webhook received (check server logs)
- [ ] Signature validation working

### Message Ingestion ✅
- [ ] Facebook DMs appear in inbox
- [ ] Instagram DMs appear in inbox (if configured)
- [ ] Comments appear in inbox
- [ ] Platform labels correct ("facebook"/"instagram")

### Automation Execution ✅
- [ ] Rules trigger on matching messages
- [ ] AI fallback works for non-matching messages
- [ ] No automation = AI response
- [ ] Usage limits enforced (80% warning)

### Reply Delivery ✅
- [ ] Replies sent back to Messenger
- [ ] Replies sent back to Instagram
- [ ] Conversation threading maintained
- [ ] No duplicate replies

### Error Handling ✅
- [ ] API failures logged but don't break flow
- [ ] Invalid tokens show clear errors
- [ ] Rate limits handled gracefully

## Troubleshooting

### Webhook Issues
- **HTTPS Required**: Meta requires HTTPS for production webhooks
- **Domain Mismatch**: Webhook URL must match your app's domain
- **Verify Token**: Must match exactly (case-sensitive)

### OAuth Issues
- **Permissions**: Ensure all required scopes granted
- **App Review**: Some permissions need review for production
- **Token Storage**: Check that tokens are saved correctly

### Message Flow Issues
- **Page Connection**: Ensure page is properly connected
- **Token Validity**: Check token hasn't expired
- **API Permissions**: Verify app has messaging permissions

## Success Criteria

**Phase 2A.1 PASSED** when:
- ✅ Webhooks receive and process messages
- ✅ Messages appear in dashboard inbox
- ✅ Automation rules trigger correctly
- ✅ Replies are delivered back to Meta platforms
- ✅ Platform labeling is accurate
- ✅ No critical errors in logs

---

## Emergency Rollback

If issues occur:
1. Disconnect pages in dashboard
2. Revert environment variables to mock values
3. Check server logs for error details
4. Verify Meta app configuration

## Next Steps (After Success)

Once live testing passes:
- ✅ Proceed to Phase 2B: OpenAI Token Accounting
- ✅ Implement Meta token lifecycle management
- ✅ Add integration health indicators

---

*Execute these steps in Meta Developers Console to complete live validation.*
# OAuth Production Configuration Guide

## Current Production Domains
- **Frontend (Vercel)**: `https://grateful-net.vercel.app`
- **Backend (Railway)**: `https://grateful-production.up.railway.app`

## Google OAuth Console Configuration

### 1. Update Authorized Redirect URIs

In your Google Cloud Console (https://console.cloud.google.com/):

1. **Navigate to Credentials**:
   - Go to "APIs & Services" → "Credentials"
   - Find your OAuth 2.0 Client ID (format: `[CLIENT_ID].apps.googleusercontent.com`)

2. **Add Production Redirect URIs**:
   ```
   https://grateful-net.vercel.app/auth/callback/google
   https://www.grateful-net.vercel.app/auth/callback/google
   ```

3. **Keep Development URIs** (for local testing):
   ```
   http://localhost:3000/auth/callback/google
   ```

### 2. Update Authorized JavaScript Origins

Add these origins to allow OAuth requests:
```
https://grateful-net.vercel.app
https://www.grateful-net.vercel.app
http://localhost:3000
```

### 3. Verify Domain Ownership (if required)

If Google requires domain verification:
1. Go to Google Search Console
2. Add and verify `grateful-net.vercel.app`
3. Follow Google's domain verification process

## OAuth Credentials Configuration

- **Client ID**: Configure in Google Cloud Console (format: `[CLIENT_ID].apps.googleusercontent.com`)
- **Client Secret**: Set production secret in Railway environment variables
- **Development Secret**: Set development secret in local `.env` file

## Next Steps

1. ✅ Update Google OAuth Console with production redirect URIs
2. ⏳ Configure Railway environment variables
3. ⏳ Update frontend production environment
4. ⏳ Configure CORS for production domains
5. ⏳ Test OAuth flow in production

## Security Notes

- Production client secret is different from development
- HTTPS-only cookies are enforced in production
- Secure session handling with proper SameSite settings
- CORS restricted to specific production domains
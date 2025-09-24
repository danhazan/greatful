# Vercel Deployment Fix

## Issue
The Vercel build is failing because it's trying to build from the root directory instead of the `apps/web` directory, causing module resolution issues.

## Solution

### Option 1: Reconfigure Existing Project (Recommended)

1. **Go to your Vercel project dashboard**
   - Visit https://vercel.com/dashboard
   - Select your project

2. **Update Project Settings**
   - Go to Settings → General
   - In the "Build & Output Settings" section:
     - **Framework Preset**: Next.js
     - **Root Directory**: `apps/web` (This is crucial!)
     - **Build Command**: `npm run build`
     - **Output Directory**: `.next`
     - **Install Command**: `npm install`

3. **Set Environment Variables**
   - Go to Settings → Environment Variables
   - Add these variables for **Production** environment:
     ```
     NODE_ENV=production
     NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api/v1
     NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
     NEXT_TELEMETRY_DISABLED=1
     ```

4. **Redeploy**
   - Go to Deployments tab
   - Click "Redeploy" on the latest deployment

### Option 2: Create New Project with Correct Settings

1. **Delete the current Vercel project** (if needed)

2. **Create new project**
   - Import from GitHub
   - Select the repository
   - **IMPORTANT**: Set Root Directory to `apps/web` during setup

3. **Configure as above**

## Environment Variables Needed

```env
# Core Configuration
NODE_ENV=production
NEXT_TELEMETRY_DISABLED=1

# API Configuration (Update with your actual URLs)
NEXT_PUBLIC_API_URL=https://your-backend-url.railway.app/api/v1
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

# Optional Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_ENABLE_SW=true
```

## Verification

After fixing the configuration, the build should succeed. You can verify by:

1. Checking that the build completes without module resolution errors
2. Testing the deployed site loads correctly
3. Verifying API proxy routes work (they should proxy to your backend)

## Next Steps

Once deployment is successful:
1. Update the `NEXT_PUBLIC_APP_URL` environment variable with your actual Vercel domain
2. Configure your backend CORS settings to allow your Vercel domain
3. Test all functionality including authentication and API calls
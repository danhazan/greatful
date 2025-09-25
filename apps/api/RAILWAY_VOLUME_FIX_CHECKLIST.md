# Railway Volume Persistence Fix - Deployment Checklist

## Problem Summary
Uploads were disappearing after Railway redeploys because:
1. `UPLOAD_PATH` was set to relative path `./uploads` instead of absolute path `/app/uploads`
2. Railway volume mount at `/app/uploads` wasn't being used by the application
3. Files were being written to ephemeral container filesystem instead of persistent volume

## Applied Fixes

### ✅ 1. Configuration Updates
- **railway.toml**: Volume configuration confirmed at `/app/uploads`
- **config/.env.railway**: Added `UPLOAD_PATH=/app/uploads`
- **config/.env.production**: Updated `UPLOAD_PATH=/app/uploads`

### ✅ 2. Code Updates
- **FileUploadService**: Now handles absolute paths and sets proper permissions
- **main.py**: Startup code ensures absolute path usage and proper permissions
- **Debug endpoints**: Added for testing volume persistence

### ✅ 3. Railway Deployment Script
- **scripts/railway_deploy.py**: Updated to include `UPLOAD_PATH` configuration

## Railway Dashboard Configuration Steps

### 1. Volume Attachment (CRITICAL)
1. Go to Railway Dashboard → Your Project → Your Service
2. Click on **Volumes** tab
3. Verify `grateful-volume` is listed and attached
4. Confirm settings:
   - **Mount Path**: `/app/uploads`
   - **Environment**: `production` (or your target environment)
   - **Size**: 5GB (or as needed)

### 2. Environment Variables
Set these in Railway Dashboard → Service → Variables:
```
UPLOAD_PATH=/app/uploads
ENVIRONMENT=production
```

### 3. Service Configuration
- **Root Directory**: `apps/api`
- **Start Command**: `alembic -c alembic.ini upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`

## Testing Steps

### 1. Deploy and Test
```bash
# After deployment, test the debug endpoints
curl https://your-app.railway.app/_debug/uploads-status
curl -X POST https://your-app.railway.app/_debug/create-sentinel
```

### 2. Verify Volume Mount
Check the debug response for:
- `abs_path`: Should be `/app/uploads`
- `mounts_head`: Should show volume mount (look for `/app/uploads`)
- `exists`: Should be `true`

### 3. Test Persistence
1. Create a sentinel file via debug endpoint
2. Make a small code change and redeploy
3. Check if sentinel file still exists after redeploy

## Expected Debug Response (Success)
```json
{
  "UPLOAD_PATH_env": "/app/uploads",
  "abs_path": "/app/uploads", 
  "exists": true,
  "listing_preview": ["posts", "profile_photos", "sentinel-..."],
  "mounts_head": ["... /app/uploads ..."],
  "permissions": {"mode": "0o40755", "uid": 0, "gid": 0}
}
```

## Troubleshooting

### Issue: Files Still Disappear
**Possible Causes:**
1. Volume not attached in Railway Dashboard
2. Wrong environment (volume attached to staging but deploying to production)
3. Railway volume limitations (single-instance binding)

**Solutions:**
1. Verify volume attachment in Railway Dashboard
2. Check environment matches between volume and deployment
3. Consider migrating to S3 for multi-instance reliability

### Issue: Permission Denied
**Possible Causes:**
1. Volume mounted with wrong permissions
2. Application running as different user

**Solutions:**
1. Check `process_uid` and `process_gid` in debug response
2. Ensure volume permissions allow write access
3. Railway typically runs as root (uid=0), but this can vary

### Issue: Volume Not Mounting
**Possible Causes:**
1. Volume not created or attached
2. Mount path mismatch
3. Railway service configuration issue

**Solutions:**
1. Recreate volume in Railway Dashboard
2. Verify mount path is exactly `/app/uploads`
3. Check Railway service logs for mount errors

## Fallback: S3 Migration

If Railway volumes prove unreliable, migrate to S3:

### 1. Environment Variables
```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_S3_BUCKET_NAME=your-bucket
AWS_S3_REGION=us-east-1
```

### 2. Update Dependencies
```bash
pip install boto3
```

### 3. Implementation
See `scripts/fix_railway_volume_persistence.py --migrate-to-s3` for detailed guide.

## Cleanup

After confirming persistence works:
1. Remove debug endpoints from production:
   ```python
   # Remove from main.py:
   from debug_uploads import router as debug_router
   app.include_router(debug_router, tags=["debug"])
   ```
2. Delete `debug_uploads.py`
3. Remove debug routes from Railway deployment

## Monitoring

Set up monitoring for upload functionality:
1. Health checks that verify upload directory accessibility
2. Alerts for upload failures
3. Regular cleanup of old files to manage volume space

## Contact

If issues persist after following this checklist:
1. Check Railway status page for volume service issues
2. Contact Railway support with volume attachment details
3. Consider S3 migration for production reliability
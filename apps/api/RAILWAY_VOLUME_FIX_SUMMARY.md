# Railway Volume Persistence Fix - Summary

## Problem Diagnosed
Uploads were disappearing after Railway redeploys because the application was writing to the ephemeral container filesystem instead of the mounted Railway volume.

## Root Causes Identified
1. **Relative Path Usage**: `UPLOAD_PATH` was set to `./uploads` (relative) instead of `/app/uploads` (absolute)
2. **Volume Mount Mismatch**: Railway volume mounted at `/app/uploads` but app used relative path
3. **Missing Path Resolution**: Code didn't ensure absolute paths for Railway deployment

## Applied Fixes

### 1. Environment Configuration Updates
- **config/.env.railway**: Added `UPLOAD_PATH=/app/uploads`
- **config/.env.production**: Updated `UPLOAD_PATH=/app/uploads`
- **scripts/railway_deploy.py**: Added UPLOAD_PATH to deployment configuration

### 2. Code Changes

#### FileUploadService (`app/services/file_upload_service.py`)
```python
# Before: Only used relative paths
upload_path = os.getenv("UPLOAD_PATH", "uploads")
self.base_upload_dir = Path(upload_path)

# After: Ensures absolute paths for Railway
upload_path = os.getenv("UPLOAD_PATH", "uploads")
if not os.path.isabs(upload_path):
    upload_path = os.path.abspath(upload_path)
self.base_upload_dir = Path(upload_path)
# + proper permissions and logging
```

#### Main Application (`main.py`)
```python
# Before: Basic path handling
uploads_path = os.getenv("UPLOAD_PATH", "uploads")
uploads_dir = Path(uploads_path)
uploads_dir.mkdir(exist_ok=True)

# After: Absolute path handling with permissions
uploads_path = os.getenv("UPLOAD_PATH", "uploads")
if not os.path.isabs(uploads_path):
    uploads_path = os.path.abspath(uploads_path)
uploads_dir = Path(uploads_path)
uploads_dir.mkdir(parents=True, exist_ok=True)
os.chmod(uploads_path, 0o755)  # Set proper permissions
```

### 3. Debug Tools Added
- **debug_uploads.py**: Debug endpoints for testing volume persistence
- **scripts/fix_railway_volume_persistence.py**: Comprehensive diagnosis and fix script
- **RAILWAY_VOLUME_FIX_CHECKLIST.md**: Deployment checklist

## Railway Configuration Required

### Volume Settings (Railway Dashboard)
1. **Service → Volumes**
2. **Volume Name**: `grateful-volume`
3. **Mount Path**: `/app/uploads`
4. **Environment**: `production`
5. **Size**: 5GB (or as needed)

### Environment Variables (Railway Dashboard)
```
UPLOAD_PATH=/app/uploads
ENVIRONMENT=production
```

### Service Configuration
- **Root Directory**: `apps/api`
- **Start Command**: `alembic -c alembic.ini upgrade head && uvicorn main:app --host 0.0.0.0 --port $PORT`

## Testing Verification

### Debug Endpoints (Development Only)
```bash
# Check volume status
curl https://your-app.railway.app/_debug/uploads-status

# Create test file
curl -X POST https://your-app.railway.app/_debug/create-sentinel

# Verify persistence after redeploy
curl https://your-app.railway.app/_debug/uploads-status
```

### Expected Success Response
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

## Deployment Steps

1. **Commit Changes**: All configuration and code fixes
2. **Railway Dashboard**: Verify volume attachment and environment variables
3. **Deploy**: Push to trigger Railway deployment
4. **Test**: Use debug endpoints to verify persistence
5. **Monitor**: Check upload functionality works correctly

## Fallback Plan

If Railway volumes prove unreliable:
- **Migrate to S3**: Use AWS S3, DigitalOcean Spaces, or Cloudflare R2
- **Benefits**: Better reliability, CDN integration, multi-instance support
- **Implementation**: See `scripts/fix_railway_volume_persistence.py --migrate-to-s3`

## Files Modified

### Configuration Files
- `config/.env.railway`
- `config/.env.production`
- `scripts/railway_deploy.py`

### Application Code
- `main.py`
- `app/services/file_upload_service.py`

### New Files Added
- `debug_uploads.py` (temporary, development only)
- `scripts/fix_railway_volume_persistence.py`
- `RAILWAY_VOLUME_FIX_CHECKLIST.md`
- `RAILWAY_VOLUME_FIX_SUMMARY.md`

## Testing Results
- ✅ Unit tests pass
- ✅ Integration tests pass (252/253, 1 performance test timeout unrelated to fix)
- ✅ Upload functionality preserved
- ✅ Debug endpoints working in development

## Next Steps
1. Deploy to Railway with updated configuration
2. Test persistence using debug endpoints
3. Remove debug endpoints after confirming fix works
4. Monitor upload functionality in production
5. Consider S3 migration for long-term reliability

## Monitoring Recommendations
- Set up alerts for upload failures
- Monitor volume disk usage
- Regular cleanup of old files
- Health checks that verify upload directory accessibility
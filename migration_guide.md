# Migrating Grateful Backend from Railway to Render

## Prerequisites
- GitHub account connected to Render
- Access to your Railway Postgres database (for backup)
- OAuth credentials (Google, Facebook)

## Step 1: Backup Your Railway Database

Before migrating, backup your PostgreSQL database:

```bash
# Get your Railway DATABASE_URL from Railway dashboard
railway variables

# Backup the database
pg_dump <YOUR_RAILWAY_DATABASE_URL> > grateful_backup.sql
```

## Step 2: Prepare Your Repository

1. Add the `render.yaml` file to the root of your repository (already created above)
2. Make sure your `requirements.txt` is in `apps/api/` directory
3. Commit and push:

```bash
git add render.yaml
git commit -m "Add Render configuration"
git push origin main
```

## Step 3: Create Render Account and New Service

1. Go to https://render.com and sign up/login with GitHub
2. Click **"New +"** → **"Blueprint"**
3. Connect your `danhazan/greatful` repository
4. Render will detect the `render.yaml` and show you the services it will create:
   - `grateful-api` (Web Service)
   - `grateful-db` (PostgreSQL Database)
5. Click **"Apply"**

## Step 4: Configure Environment Variables

Render will auto-create most variables from `render.yaml`, but you need to add secrets manually:

1. Go to your `grateful-api` service dashboard
2. Click **"Environment"** in the left sidebar
3. Add these secret variables:
   - `GOOGLE_CLIENT_ID` - from your Railway/Google Console
   - `GOOGLE_CLIENT_SECRET` - from your Railway/Google Console
   - `FACEBOOK_CLIENT_ID` - from your Railway/Facebook
   - `FACEBOOK_CLIENT_SECRET` - from your Railway/Facebook
   - `SESSION_SECRET` - generate a new one or copy from Railway
   - `REDIS_URL` - (if you're using Redis, see note below)

**Note about Redis**: I noticed your Railway config references Redis. The free tier of Render doesn't include Redis. Options:
- Use **Upstash Redis** (generous free tier) - https://upstash.com
- Remove Redis if not critical
- Use in-memory caching instead

## Step 5: Restore Database

Once your Postgres database is provisioned:

1. Get the connection string from Render dashboard:
   - Go to `grateful-db` database
   - Copy **"External Connection String"**

2. Restore your backup:

```bash
psql <RENDER_DATABASE_URL> < grateful_backup.sql
```

Or use Render's built-in shell:
- Click on your database → **"Shell"** tab
- Upload and restore the SQL file

## Step 6: Deploy and Test

1. Render will automatically deploy your service
2. Wait for the build to complete (check **"Logs"** tab)
3. Once deployed, you'll get a URL like: `https://grateful-api.onrender.com`
4. Test the API:

```bash
curl https://grateful-api.onrender.com/health
# or whatever your health check endpoint is
```

## Step 7: Update Vercel Frontend

Update your Vercel environment variables to point to the new backend:

1. Go to Vercel dashboard → Your project → **Settings** → **Environment Variables**
2. Update `NEXT_PUBLIC_API_URL` (or similar) to your new Render URL:
   ```
   NEXT_PUBLIC_API_URL=https://grateful-api.onrender.com
   ```
3. Redeploy your Vercel app:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

## Step 8: Update OAuth Redirect URIs

Update your OAuth app settings:

**Google Cloud Console:**
1. Go to APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add authorized redirect URI: `https://grateful-api.onrender.com/auth/callback/google`

**Facebook Developers:**
1. Go to your app settings
2. Update redirect URIs to include new Render URL

## Important Notes

### Free Tier Limitations
- **Web Service**: 750 hours/month (enough for 1 always-on service)
- **PostgreSQL**: Free for 90 days, then expires (you can backup/restore to refresh)
- **Disk Storage**: 1GB persistent storage included
- **Cold Starts**: Free tier services spin down after 15 minutes of inactivity (first request takes ~30 seconds)

### Set Calendar Reminder
⚠️ **Important**: Set a reminder for 85 days from now to backup and refresh your Postgres database before it expires.

### Handling Cold Starts
To keep your service warm:
- Use a service like **UptimeRobot** (free) to ping your API every 10 minutes
- Or accept the 30-second cold start delay

## Troubleshooting

### Build Fails
- Check the **"Logs"** tab for error messages
- Make sure `requirements.txt` includes all dependencies
- Verify Python version matches your local setup

### Database Connection Issues
- Ensure `DATABASE_URL` environment variable is set correctly
- Check if Alembic migrations ran successfully in logs
- Verify database is in the same region as your web service

### Volume/Upload Issues
- Make sure the disk is mounted at `/var/data/uploads`
- Check disk usage in Render dashboard
- Verify upload path matches `UPLOAD_PATH` env var

## Rollback Plan

If something goes wrong, you can quickly rollback:
1. Keep Railway running during migration
2. Point Vercel back to Railway URL
3. Debug Render setup without downtime

## Post-Migration Checklist

- [ ] Backend deployed and accessible
- [ ] Database migrated and working
- [ ] Environment variables configured
- [ ] OAuth working (test Google/Facebook login)
- [ ] Frontend connected to new backend
- [ ] File uploads working
- [ ] Calendar reminder set for DB refresh (85 days)
- [ ] Railway services stopped/deleted
- [ ] UptimeRobot or similar set up (optional)

## Questions?

If you run into issues, check:
1. Render logs: Dashboard → Service → Logs
2. Render community: https://community.render.com
3. Your database credentials and connection string

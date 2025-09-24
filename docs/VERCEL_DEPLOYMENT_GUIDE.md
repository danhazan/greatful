# Vercel Frontend Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Grateful frontend to Vercel, including configuration, environment variables, and testing procedures.

## Prerequisites

- GitHub repository with the Grateful project
- Vercel account (free tier is sufficient for MVP)
- Backend API deployed (Railway recommended)
- Domain name (optional, Vercel provides free subdomain)

## Deployment Steps

### 1. Connect GitHub Repository to Vercel

1. **Login to Vercel Dashboard**
   - Go to [vercel.com](https://vercel.com)
   - Sign in with GitHub account

2. **Import Project**
   - Click "New Project"
   - Select your GitHub repository
   - Choose "Import" next to your grateful repository

3. **Configure Project Settings**
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `apps/web`
   - **Build Command**: `npm run build` (auto-detected)
   - **Output Directory**: `.next` (auto-detected)
   - **Install Command**: `npm install` (auto-detected)

### 2. Configure Environment Variables

In the Vercel dashboard, go to your project → Settings → Environment Variables and add:

#### Required Variables
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api-domain.railway.app/api/v1
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
NEXT_TELEMETRY_DISABLED=1
```

#### Optional Variables
```env
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_ERROR_REPORTING=true
NEXT_PUBLIC_ENABLE_SW=true
NEXT_PUBLIC_BUILD_TIME=2025-01-08T00:00:00Z
NEXT_PUBLIC_VERSION=1.0.0
```

**Important Notes:**
- Replace `your-api-domain.railway.app` with your actual Railway backend URL
- Replace `your-app.vercel.app` with your actual Vercel domain
- All variables should be set for "Production" environment
- `NEXT_PUBLIC_` prefix makes variables available in the browser

### 3. Configure Build Settings

The project includes a pre-configured `vercel.json` file with optimal settings:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "npm install",
  "regions": ["iad1"],
  "functions": {
    "src/app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "rewrites": [
    {
      "source": "/api/v1/(.*)",
      "destination": "$NEXT_PUBLIC_API_URL/$1"
    }
  ],
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        }
      ]
    }
  ]
}
```

**Key Features:**
- **API Rewrites**: Proxies `/api/v1/*` requests to backend
- **Security Headers**: Adds security headers to all responses
- **Function Timeout**: 30 seconds for API routes
- **Region**: US East (iad1) for optimal performance

### 4. Set Up Automatic Deployments

1. **Configure Git Integration**
   - In Vercel dashboard → Settings → Git
   - Ensure "Automatic deployments" is enabled
   - Set production branch to `main`

2. **Branch Protection (Optional)**
   - Configure branch protection rules in GitHub
   - Require pull request reviews before merging to main
   - Enable status checks for Vercel deployments

### 5. Custom Domain Configuration (Optional)

1. **Add Domain in Vercel**
   - Go to project → Settings → Domains
   - Add your custom domain (e.g., `grateful.yourdomain.com`)

2. **Configure DNS**
   - Add CNAME record pointing to `cname.vercel-dns.com`
   - Or add A records pointing to Vercel's IP addresses

3. **SSL Certificate**
   - Vercel automatically provisions SSL certificates
   - Certificates auto-renew before expiration

### 6. Verify Deployment

#### Test Core Functionality
```bash
# Test homepage
curl -I https://your-app.vercel.app

# Test API proxy
curl https://your-app.vercel.app/api/v1/health

# Test authentication pages
curl -I https://your-app.vercel.app/auth/login
curl -I https://your-app.vercel.app/auth/signup

# Test main application pages
curl -I https://your-app.vercel.app/feed
curl -I https://your-app.vercel.app/profile
```

#### Verify Security Headers
```bash
curl -I https://your-app.vercel.app | grep -E "(X-Frame-Options|X-Content-Type-Options|Referrer-Policy)"
```

#### Test Mobile Responsiveness
- Open deployment URL on mobile devices
- Test touch interactions and responsive design
- Verify all modals and components work on mobile

## Monitoring and Maintenance

### Vercel Analytics

1. **Enable Analytics**
   - Go to project → Analytics tab
   - Enable Web Analytics (free tier available)
   - Monitor page views, performance, and user behavior

2. **Performance Monitoring**
   - Monitor Core Web Vitals
   - Track page load times
   - Identify performance bottlenecks

### Deployment Monitoring

1. **Build Logs**
   - Monitor build success/failure in Vercel dashboard
   - Check build logs for warnings or errors
   - Set up notifications for failed deployments

2. **Function Logs**
   - Monitor API route performance
   - Check for timeout issues
   - Monitor error rates

### Error Tracking

1. **Runtime Errors**
   - Monitor function errors in Vercel dashboard
   - Set up error notifications
   - Track error patterns and frequency

2. **Build Errors**
   - Monitor build failures
   - Check for dependency issues
   - Verify environment variable configuration

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Check build locally
cd apps/web
npm run build

# Check TypeScript errors
npm run type-check

# Check for missing dependencies
npm install
```

#### Environment Variable Issues
- Verify all required variables are set in Vercel dashboard
- Check variable names (case-sensitive)
- Ensure `NEXT_PUBLIC_` prefix for client-side variables

#### API Connection Issues
- Verify `NEXT_PUBLIC_API_URL` points to correct backend
- Check CORS configuration in backend
- Test API endpoints directly

#### Domain/SSL Issues
- Verify DNS configuration
- Check domain verification in Vercel
- Wait for SSL certificate provisioning (can take up to 24 hours)

### Performance Issues

#### Slow Build Times
- Check for large dependencies
- Optimize image assets
- Review bundle size analysis

#### Runtime Performance
- Monitor Core Web Vitals
- Optimize component rendering
- Check for memory leaks

### Rollback Procedures

#### Rollback to Previous Deployment
1. Go to Vercel dashboard → Deployments
2. Find previous successful deployment
3. Click "Promote to Production"

#### Emergency Rollback
```bash
# Using Vercel CLI
npm i -g vercel
vercel login
vercel rollback [previous-deployment-url]
```

## Security Considerations

### Environment Variables
- Never commit production environment variables
- Use Vercel's secure environment variable storage
- Rotate secrets regularly

### Domain Security
- Enable HSTS headers (configured in vercel.json)
- Use strong CSP headers
- Monitor for subdomain takeover attempts

### API Security
- Ensure backend has proper CORS configuration
- Use HTTPS for all API communications
- Implement proper rate limiting

## Cost Optimization

### Vercel Pricing Tiers
- **Hobby (Free)**: 100GB bandwidth, unlimited personal projects
- **Pro ($20/month)**: 1TB bandwidth, team collaboration, analytics
- **Enterprise**: Custom pricing, advanced features

### Optimization Tips
- Optimize images and assets
- Use Next.js Image component for automatic optimization
- Monitor bandwidth usage in Vercel dashboard
- Implement proper caching strategies

## Maintenance Procedures

### Regular Maintenance
- Monitor deployment success rates
- Review performance metrics weekly
- Update dependencies monthly
- Check security headers quarterly

### Emergency Procedures
- Have rollback plan ready
- Monitor error rates during deployments
- Set up alerting for critical issues
- Maintain communication channels for incidents

## Integration with Backend

### CORS Configuration
Ensure your Railway backend includes your Vercel domain in CORS settings:

```python
# In your FastAPI backend
ALLOWED_ORIGINS = [
    "https://your-app.vercel.app",
    "https://your-custom-domain.com",
    "http://localhost:3000"  # For development
]
```

### API Proxy Configuration
The `vercel.json` configuration includes API rewrites that proxy requests to your backend:

```json
"rewrites": [
  {
    "source": "/api/v1/(.*)",
    "destination": "$NEXT_PUBLIC_API_URL/$1"
  }
]
```

This allows the frontend to make requests to `/api/v1/posts` which get proxied to your Railway backend.

## Success Criteria

### Deployment Success
- [ ] Frontend builds successfully on Vercel
- [ ] All pages load without errors
- [ ] API proxy works correctly
- [ ] Authentication flow functions properly
- [ ] Mobile responsiveness verified

### Performance Targets
- [ ] Core Web Vitals scores in "Good" range
- [ ] Page load times under 3 seconds
- [ ] API response times under 500ms
- [ ] Build times under 2 minutes

### Security Verification
- [ ] Security headers present in responses
- [ ] HTTPS enforced for all requests
- [ ] No sensitive data exposed in client-side code
- [ ] CORS properly configured

## Next Steps

After successful Vercel deployment:

1. **Update Documentation**
   - Update `docs/PRODUCTION_DEPLOYMENT.md` with Vercel-specific steps
   - Add Vercel URLs to `docs/USEFUL_COMMANDS.md`
   - Update `README.md` with deployment links

2. **Set Up Monitoring**
   - Configure Vercel Analytics
   - Set up error tracking
   - Monitor performance metrics

3. **Configure CI/CD**
   - Set up preview deployments for pull requests
   - Configure deployment notifications
   - Implement automated testing on deployments

4. **Domain Configuration**
   - Configure custom domain if desired
   - Set up proper DNS records
   - Verify SSL certificate provisioning

This guide ensures a smooth and secure deployment of the Grateful frontend to Vercel with proper monitoring and maintenance procedures.
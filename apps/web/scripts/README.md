# Frontend Scripts

This folder contains **frontend-specific scripts** for development, testing, and deployment of the Next.js application.

## Scripts Overview

### Development & Testing
- **`health-check.js`** - Frontend development server health checking with console error detection

## Usage

All scripts in this folder should be run from the **frontend directory**:

```bash
# Navigate to frontend
cd apps/web

# Run scripts
node scripts/health-check.js
node scripts/health-check.js /auth/signup
node scripts/health-check.js --no-console
```

## Script Details

### `health-check.js`
Comprehensive development server health checking tool that:
- Starts `npm run dev` automatically
- Tests accessibility on common ports (3000, 5173, 8080)
- Detects browser console errors using Puppeteer (optional)
- Reports JavaScript errors, React errors, and network failures
- Cleans up all processes after testing

**Usage Examples:**
```bash
# Test root path with console error detection
node scripts/health-check.js

# Test specific path
node scripts/health-check.js /auth/signup

# Skip console error detection
node scripts/health-check.js --no-console

# Show help
node scripts/health-check.js --help
```

**Requirements:**
- Node.js and npm installed
- Optional: `npm install puppeteer --save-dev` for console error detection

## Script Categories

### ✅ Belongs in `/apps/web/scripts`:
- Frontend development utilities
- Next.js specific build/deployment scripts
- React component testing utilities
- Frontend-specific health checks
- Client-side performance testing
- Asset optimization scripts

### ❌ Does NOT belong here:
- Cross-project utilities (use `/scripts` instead)
- Backend-specific scripts (use `/apps/api/scripts` instead)
- Database operations or API utilities

## Adding New Frontend Scripts

When adding new frontend scripts, consider:

1. **Dependencies**: Does it require Next.js or React context?
2. **Scope**: Is it specific to the web application?
3. **Environment**: Does it need to run in the frontend directory?

**If frontend-specific** → Add to `/apps/web/scripts`  
**If cross-project** → Add to `/scripts`
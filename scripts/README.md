# Project Scripts

This folder contains **cross-project scripts** that affect both frontend and backend or provide project-wide utilities.

## Scripts Overview

### Development & Testing
- **`load_test_script.sh`** - Comprehensive load testing with Apache Bench
- **`mvp_features_test.sh`** - MVP feature validation and production readiness testing

### Operations & Monitoring  
- **`kill_servers.sh`** - Kill development servers across all apps
- **`monitoring.sh`** - Cross-project monitoring and health checks

## Usage

All scripts in this folder should be run from the **project root directory**:

```bash
# From project root (grateful/)
./scripts/load_test_script.sh
./scripts/mvp_features_test.sh
./scripts/kill_servers.sh
./scripts/monitoring.sh
```

## Script Categories

### ✅ Belongs in `/scripts` (root):
- Cross-project utilities (affect both frontend and backend)
- Development workflow scripts (testing, monitoring, deployment)
- Project-wide operations (health checks, load testing)
- CI/CD pipeline scripts

### ❌ Does NOT belong in `/scripts` (root):
- App-specific utilities (use `apps/{app}/scripts/` instead)
- Scripts that require specific app context or dependencies
- Database-specific operations (use `apps/api/scripts/`)
- Frontend-specific build or deployment scripts (use `apps/web/scripts/`)

## Adding New Scripts

When adding new scripts, consider:

1. **Scope**: Does it affect multiple apps or just one?
2. **Dependencies**: Does it require specific app context?
3. **Usage**: Will it be used in CI/CD or development workflows?

**If cross-project** → Add to `/scripts`  
**If app-specific** → Add to `/apps/{app}/scripts`
#!/usr/bin/env node

/**
 * System Contract Checker
 * 
 * Verifies that each critical flow in SYSTEM_CONTRACT_MAP.md has:
 * - Frontend @flow test coverage
 * - Backend integration/contract test coverage
 * 
 * Usage: node scripts/system-contract-check.js
 */

const fs = require('fs');
const path = require('path');

const SCRIPT_DIR = path.dirname(process.argv[1]);
const SCRIPT_NAME = path.basename(SCRIPT_DIR);

let BASE_DIR, WEB_DIR, CONTRACT_MAP_PATH;

if (SCRIPT_NAME === 'scripts') {
  BASE_DIR = path.join(SCRIPT_DIR, '..');
  WEB_DIR = BASE_DIR;
} else {
  BASE_DIR = SCRIPT_DIR;
  WEB_DIR = path.join(SCRIPT_DIR, '..');
}

CONTRACT_MAP_PATH = path.join(WEB_DIR, '..', '..', 'docs', 'SYSTEM_CONTRACT_MAP.md');

const FRONTEND_TEST_DIRS = [
  path.join(BASE_DIR, 'src', 'tests'),
  path.join(BASE_DIR, 'src', 'app', 'feed', '__tests__'),
];

const BACKEND_TEST_DIRS = [
  path.join(WEB_DIR, '..', 'api', 'tests', 'integration'),
  path.join(WEB_DIR, '..', 'api', 'tests', 'contract'),
  path.join(WEB_DIR, '..', 'api', 'tests', 'unit'),
];

const FLOW_MAPPING = {
  'Follow User': {
    frontend: ['FollowButton.flow.test.tsx', 'follow.flow.test.tsx'],
    backend: ['test_follow_api.py', 'test_follow_notifications.py'],
    critical: true,
  },
  'Post Creation': {
    frontend: ['PostCard.flow.test.tsx', 'CreatePostModal.test.tsx', 'post.flow.test.tsx'],
    backend: ['test_posts_api.py'],
    critical: true,
  },
  'Reaction System': {
    frontend: ['PostCard.flow.test.tsx', 'reaction.flow.test.tsx'],
    backend: ['test_reactions_api.py'],
    critical: true,
  },
  'Notification System': {
    frontend: ['NotificationSystem.flow.test.tsx', 'notification.flow.test.tsx'],
    backend: ['test_notifications_api.py'],
    critical: true,
  },
  'Authentication': {
    frontend: ['OAuthButton.flow.test.tsx', 'auth.flow.test.tsx'],
    backend: ['test_oauth_endpoints.py', 'test_auth_api.py'],
    critical: true,
  },
  'Feed Rendering': {
    frontend: ['feed.flow.test.tsx'],
    backend: ['test_feed_v2.py', 'test_feed_api.py'],
    critical: true,
  },
  'Share System': {
    frontend: ['share-workflow.test.tsx', 'ShareModal.test.tsx'],
    backend: ['test_share_api.py'],
    critical: false,
  },
};

function findTestFiles(dir, extensions = ['.ts', '.tsx', '.py']) {
  const files = [];
  
  function scan(currentDir) {
    if (!fs.existsSync(currentDir)) return;
    
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        
        if (entry.isDirectory()) {
          if (!entry.name.includes('node_modules') && !entry.name.startsWith('.')) {
            scan(fullPath);
          }
        } else if (entry.isFile()) {
        // Match test files by .test. in TS/TSX, test_*.py in Python
        if (entry.name.includes('.test.') || (entry.name.startsWith('test_') && entry.name.endsWith('.py'))) {
            files.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Ignore permission errors
    }
  }
  
  scan(dir);
  return files;
}

function findFrontendFlowTests() {
  const flowTests = [];
  
  for (const dir of FRONTEND_TEST_DIRS) {
    const files = findTestFiles(dir, ['.test.ts', '.test.tsx']);
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      // Use same detection as governance check: includes '@flow' or filename contains '.flow.'
      if (content.includes('@flow') || path.basename(file).includes('.flow.')) {
        flowTests.push(path.basename(file));
      }
    }
  }
  
  return flowTests;
}

function findBackendIntegrationTests() {
  const integrationTests = [];
  
  for (const dir of BACKEND_TEST_DIRS) {
    if (!fs.existsSync(dir)) {
      console.warn(`Backend test directory not found: ${dir}`);
      continue;
    }
    
    const files = findTestFiles(dir, ['.py']);
    
    for (const file of files) {
      integrationTests.push(path.basename(file));
    }
  }
  
  return integrationTests;
}

function checkFlowCoverage(flowName, coverage) {
  const result = {
    flow: flowName,
    critical: coverage.critical !== false,
    frontend: { found: false, files: [] },
    backend: { found: false, files: [] },
    status: 'partial',
  };
  
  const frontendFiles = coverage.frontend || [];
  const backendFiles = coverage.backend || [];
  
  for (const expected of frontendFiles) {
    const found = frontendTests.some(t => t.includes(expected.replace('.test.tsx', '').replace('.test.ts', '')));
    if (found) {
      result.frontend.found = true;
      result.frontend.files.push(expected);
    }
  }
  
  for (const expected of backendFiles) {
    const found = backendTests.some(t => t.includes(expected.replace('.py', '')));
    if (found) {
      result.backend.found = true;
      result.backend.files.push(expected);
    }
  }
  
  if (result.frontend.found && result.backend.found) {
    result.status = 'complete';
  } else if (result.frontend.found || result.backend.found) {
    result.status = 'partial';
  } else {
    result.status = 'missing';
  }
  
  return result;
}

console.log('='.repeat(60));
console.log('System Contract Checker');
console.log('='.repeat(60));
console.log();

if (!fs.existsSync(CONTRACT_MAP_PATH)) {
  console.error(`ERROR: CONTRACT_MAP_PATH not found: ${CONTRACT_MAP_PATH}`);
  process.exit(1);
}

console.log('Scanning for @flow tests in frontend...');
const frontendTests = findFrontendFlowTests();
console.log(`  Found ${frontendTests.length} @flow test files`);
console.log();

console.log('Scanning for integration tests in backend...');
const backendTests = findBackendIntegrationTests();
console.log(`  Found ${backendTests.length} integration test files`);
console.log();

console.log('Checking flow coverage...');
console.log('-'.repeat(60));

const results = [];
let completeCount = 0;
let partialCount = 0;
let missingCount = 0;
let criticalGaps = [];

for (const [flowName, coverage] of Object.entries(FLOW_MAPPING)) {
  const result = checkFlowCoverage(flowName, coverage);
  results.push(result);
  
  const statusIcon = result.status === 'complete' ? '✓' : result.status === 'partial' ? '⚠' : '✗';
  const criticalFlag = result.critical ? '' : ' (non-critical)';
  
  console.log(`\n${statusIcon} ${flowName}${criticalFlag}`);
  console.log(`  Frontend: ${result.frontend.found ? '✓ Covered' : '✗ Missing'}`);
  if (result.frontend.files.length > 0) {
    console.log(`    → ${result.frontend.files.join(', ')}`);
  }
  console.log(`  Backend:  ${result.backend.found ? '✓ Covered' : '✗ Missing'}`);
  if (result.backend.files.length > 0) {
    console.log(`    → ${result.backend.files.join(', ')}`);
  }
  
  if (result.status === 'complete') completeCount++;
  else if (result.status === 'partial') partialCount++;
  else missingCount++;
  
  // Track critical gaps separately
  if (result.status !== 'complete' && result.critical) {
    criticalGaps.push(result.flow);
  }
}

console.log();
console.log('-'.repeat(60));
console.log('\nSummary:');
console.log(`  Complete: ${completeCount} flows`);
console.log(`  Partial:  ${partialCount} flows`);
console.log(`  Missing:  ${missingCount} flows`);
console.log();

// Only warn about critical flow gaps
if (criticalGaps.length > 0) {
  console.log('⚠ WARNINGS: Critical flows lack complete coverage');
  console.log(`  Missing coverage for: ${criticalGaps.join(', ')}`);
  console.log();
}

// Always show info about non-critical flows
const nonCriticalPartial = results.filter(r => r.status === 'partial' && !r.critical).map(r => r.flow);
if (nonCriticalPartial.length > 0) {
  console.log('ℹ INFO: Non-critical flows have partial coverage (acceptable)');
  console.log(`  Partial: ${nonCriticalPartial.join(', ')}`);
  console.log();
}

if (completeCount === Object.keys(FLOW_MAPPING).length) {
  console.log('✓ All system flows have complete test coverage');
  process.exit(0);
} else if (criticalGaps.length > 0) {
  console.log('⚠ Critical flow coverage gaps need attention');
  process.exit(1);
} else {
  console.log('✓ All critical flows covered (non-critical gaps are acceptable)');
  process.exit(0);
}
#!/usr/bin/env node

/**
 * Test Governance Validator
 * 
 * Validates test files against governance rules:
 * 1. @flow tests must not mock internal hooks
 * 2. Skipped tests must have classification comment
 * 3. Each test must have layer tag (@unit/@behavior/@interaction/@flow)
 * 4. Each feature must have @flow test coverage
 */

const fs = require('fs');
const path = require('path');

// Configuration
const SCRIPT_DIR = __dirname;
const BASE_DIR = path.join(SCRIPT_DIR, '..');
const TEST_DIRS = [
  path.join(BASE_DIR, 'src/tests'),
  path.join(BASE_DIR, 'src/app/feed/__tests__'),
];
const FEATURES = ['Follow', 'Posts', 'Notifications', 'Auth', 'Feed'];

// Internal hooks that should NOT be mocked in @flow tests
const INTERNAL_HOOKS = [
  'useUserState',
  'useFollowState', 
  'useNotificationState',
  'useUser',
  'useAuth',
];

// Skipped test classification options
const SKIP_CLASSIFICATIONS = ['MIGRATE', 'DELETE', 'REWRITE', 'KEEP'];

// Layer tags
const LAYER_TAGS = ['@unit', '@behavior', '@interaction', '@flow'];

// Results storage
const results = {
  violations: [],
  warnings: [],
  passed: [],
  featureCoverage: {},
  skippedClassification: {},
  layerCompliance: {},
};

// Helper: Scan directory for test files
function scanTestFiles(dirs, files = []) {
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        scanTestFiles([fullPath], files);
      } else if (entry.name.endsWith('.test.tsx') || entry.name.endsWith('.test.ts')) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

// Helper: Check if file is a @flow test
function isFlowTest(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.includes('@flow') || filePath.includes('.flow.');
}

// Helper: Check for internal hook mocking in @flow tests
function checkInternalHookMocks(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const violations = [];
  
  // Check for jest.mock of internal hooks
  for (const hook of INTERNAL_HOOKS) {
    const mockPattern = new RegExp(`jest\\.mock\\([^)]*['"]@/hooks/${hook}['"]`, 'g');
    if (mockPattern.test(content)) {
      violations.push(`Mocks internal hook: ${hook}`);
    }
  }
  
  return violations;
}

// Helper: Check for skipped test classification
function checkSkippedClassification(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Find all describe.skip and it.skip
  const skipPattern = /(describe|it)\.skip/g;
  const matches = content.match(skipPattern);
  
  if (matches) {
    // Check if any classification comment exists nearby
    const hasClassification = SKIP_CLASSIFICATIONS.some(cls => 
      content.includes(`// ${cls}`) || content.includes(`/* ${cls} */`)
    );
    
    if (!hasClassification) {
      issues.push('Skipped test without classification comment');
    }
  }
  
  return issues;
}

// Helper: Check for layer tags
function checkLayerTags(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  
  // Check for any describe blocks that don't have layer comments
  const describePattern = /describe\(['"]([^'"]+)['"]/g;
  let match;
  
  while ((match = describePattern.exec(content)) !== null) {
    const describeName = match[1];
    const beforeContent = content.substring(0, match.index);
    
    // Look for layer tag in last 200 chars before describe
    const searchStart = Math.max(0, match.index - 200);
    const contextBefore = content.substring(searchStart, match.index);
    
    const hasLayerTag = LAYER_TAGS.some(tag => contextBefore.includes(`// ${tag}`));
    
    if (!hasLayerTag && !describeName.includes('Flow')) {
      issues.push(`describe block "${describeName}" missing layer tag`);
    }
  }
  
  return issues;
}

// Helper: Determine feature from file path
function getFeatureFromPath(filePath) {
  const normalizedPath = filePath.toLowerCase();
  
  if (normalizedPath.includes('follow')) return 'Follow';
  if (normalizedPath.includes('post') && !normalizedPath.includes('postpage')) return 'Posts';
  if (normalizedPath.includes('notification')) return 'Notifications';
  if (normalizedPath.includes('auth') || normalizedPath.includes('oauth') || normalizedPath.includes('login')) return 'Auth';
  if (normalizedPath.includes('feed') || normalizedPath.includes('/feed/')) return 'Feed';
  
  return null;
}

// Main validation function
function validateTests() {
  console.log('🔍 Starting Test Governance Validation...\n');
  
  // Scan test files
  console.log('📂 Scanning test files...');
  const testFiles = scanTestFiles(TEST_DIRS);
  console.log(`   Found ${testFiles.length} test files\n`);
  
  // Initialize feature coverage
  FEATURES.forEach(f => results.featureCoverage[f] = { hasFlow: false, files: [] });
  
  // Process each file
  for (const file of testFiles) {
    // Normalize path for feature detection
    const normalizedPath = file.replace(/\\/g, '/');
    const relativePath = normalizedPath.replace(BASE_DIR + '/src/', '');
    const feature = getFeatureFromPath(normalizedPath);
    
    // Check 1: Internal hook mocks in @flow tests
    if (isFlowTest(file)) {
      const hookViolations = checkInternalHookMocks(file);
      
      if (hookViolations.length > 0) {
        results.violations.push({
          file: relativePath,
          type: 'INTERNAL_HOOK_MOCK',
          details: hookViolations,
        });
      }
      
      // Track feature coverage
      if (feature && !results.featureCoverage[feature].hasFlow) {
        results.featureCoverage[feature].hasFlow = true;
        results.featureCoverage[feature].files.push(relativePath);
      }
    }
    
    // Check 2: Skipped test classification
    const skipIssues = checkSkippedClassification(file);
    if (skipIssues.length > 0) {
      results.warnings.push({
        file: relativePath,
        type: 'SKIPPED_UNCLASSIFIED',
        details: skipIssues,
      });
      
      if (!results.skippedClassification[relativePath]) {
        results.skippedClassification[relativePath] = skipIssues;
      }
    }
    
    // Check 3: Layer tags
    const layerIssues = checkLayerTags(file);
    if (layerIssues.length > 0) {
      results.warnings.push({
        file: relativePath,
        type: 'MISSING_LAYER_TAG',
        details: layerIssues,
      });
    }
  }
  
  // Print results
  printResults();
  
  // Exit with appropriate code
  const hasViolations = results.violations.length > 0;
  process.exit(hasViolations ? 1 : 0);
}

function printResults() {
  console.log('═'.repeat(60));
  console.log('TEST GOVERNANCE VALIDATION RESULTS');
  console.log('═'.repeat(60) + '\n');
  
  // Feature Coverage
  console.log('📊 FEATURE COVERAGE (@flow tests)\n');
  for (const [feature, data] of Object.entries(results.featureCoverage)) {
    const status = data.hasFlow ? '✓ PASS' : '✗ FAIL';
    console.log(`   ${feature}: ${status}`);
    if (data.hasFlow) {
      console.log(`      Files: ${data.files.join(', ')}`);
    }
  }
  console.log('');
  
  // Violations
  console.log('🚨 VIOLATIONS (must fix)\n');
  if (results.violations.length === 0) {
    console.log('   No violations found ✓\n');
  } else {
    for (const v of results.violations) {
      console.log(`   ${v.file}`);
      console.log(`   Type: ${v.type}`);
      for (const d of v.details) {
        console.log(`   - ${d}`);
      }
      console.log('');
    }
  }
  
  // Warnings
  console.log('⚠️  WARNINGS (should fix)\n');
  if (results.warnings.length === 0) {
    console.log('   No warnings ✓\n');
  } else {
    console.log(`   Total: ${results.warnings.length} warnings\n`);
  }
  
  // Summary
  console.log('═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  console.log(`   Features with @flow: ${Object.values(results.featureCoverage).filter(f => f.hasFlow).length}/${FEATURES.length}`);
  console.log(`   Violations: ${results.violations.length}`);
  console.log(`   Warnings: ${results.warnings.length}`);
  console.log('');
  
  if (results.violations.length > 0) {
    console.log('❌ VALIDATION FAILED - Fix violations before committing\n');
  } else if (results.warnings.length > 0) {
    console.log('⚠️  VALIDATION PASSED WITH WARNINGS\n');
  } else {
    console.log('✅ VALIDATION PASSED\n');
  }
}

// Run validation
validateTests();
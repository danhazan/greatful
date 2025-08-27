# Code Quality Guidelines

## Import Management

**CRITICAL**: Always avoid duplicate imports in files. Each import statement should appear only once at the top of the file.

### Common Import Patterns

**React/Testing Files:**
```typescript
// ✅ CORRECT - Single imports
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from '@jest/globals'

// ❌ WRONG - Duplicate imports
import { expect } from '@jest/globals'
import { expect } from '@jest/globals'
import { it } from '@jest/globals'
```

**General Rules:**
- Import each module/function only once
- Group related imports together
- Use destructuring for multiple exports from the same module
- Remove unused imports

### Before Creating/Modifying Files:
1. Check existing imports
2. Consolidate duplicate imports
3. Remove unused imports
4. Follow consistent import ordering

This prevents build errors and maintains clean, readable code.
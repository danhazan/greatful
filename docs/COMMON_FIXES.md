# Common Fixes and Solutions

This document contains common fixes and solutions that can be applied to similar issues across the codebase.

## 📋 Table of Contents

- [Text Input Visibility Fixes](#text-input-visibility-fixes)
- [Dropdown Positioning Fixes](#dropdown-positioning-fixes)
- [Responsive Design Patterns](#responsive-design-patterns)
- [Mobile Optimization Techniques](#mobile-optimization-techniques)

---

## Text Input Visibility Fixes

### Transparent Text Input Fix

**Problem**: Text inputs on mobile devices sometimes display transparent or invisible text, making it impossible for users to see what they're typing. This commonly occurs due to browser autofill styling conflicts and mobile-specific CSS rendering issues.

**Root Cause**: Mobile browsers apply autofill styling that can override text colors, and certain CSS properties like `-webkit-text-fill-color` can make text transparent.

#### Symptoms:
- Text appears invisible or transparent when typing in input fields
- Placeholder text is visible but typed text is not
- Issue primarily occurs on mobile devices (iOS Safari, Chrome mobile)
- Affects login, signup, search, and profile edit forms

#### Solution: Shared Input Styling Utility

Create a shared utility that applies consistent styling to ensure text visibility across all input types.

#### Implementation:

**1. Create shared utility (`apps/web/src/utils/inputStyles.ts`):**
```typescript
import { CSSProperties } from 'react'

/**
 * Base input styles that ensure text visibility on all devices
 * Fixes the transparent text issue that occurs on mobile browsers
 */
export const getVisibleTextInputStyles = (): CSSProperties => ({
  // Ensure text is always visible
  color: '#374151', // gray-700
  backgroundColor: 'transparent',
  
  // Fix mobile text positioning issues
  WebkitUserSelect: 'text',
  userSelect: 'text',
  WebkitTouchCallout: 'default',
  WebkitTapHighlightColor: 'transparent',
  
  // Ensure proper text positioning on mobile
  lineHeight: '1.5',
  wordWrap: 'break-word',
  overflowWrap: 'break-word',
  
  // Fix iOS Safari text positioning and autofill issues
  WebkitTextSizeAdjust: '100%',
  WebkitTextFillColor: '#374151', // Prevents autofill from making text transparent
  
  // Ensure caret is visible
  caretColor: '#374151'
})

/**
 * Tailwind classes that complement the inline styles
 */
export const VISIBLE_TEXT_INPUT_CLASSES = 'text-gray-700 placeholder-gray-400'

/**
 * Complete input styling solution
 */
export const getCompleteInputStyling = () => ({
  style: getVisibleTextInputStyles(),
  className: VISIBLE_TEXT_INPUT_CLASSES
})
```

**2. Apply to input elements:**
```tsx
import { getCompleteInputStyling } from '@/utils/inputStyles'

// For regular inputs
<input
  type="text"
  className={`your-existing-classes ${getCompleteInputStyling().className}`}
  style={getCompleteInputStyling().style}
  // ... other props
/>

// For textareas
<textarea
  className={`your-existing-classes ${getCompleteInputStyling().className}`}
  style={getCompleteInputStyling().style}
  // ... other props
/>
```

#### Key CSS Properties:

- `color: '#374151'` - Ensures text color is always visible
- `WebkitTextFillColor: '#374151'` - **Critical**: Prevents autofill from making text transparent
- `caretColor: '#374151'` - Ensures cursor is visible
- `WebkitTextSizeAdjust: '100%'` - Prevents iOS Safari text scaling issues
- `backgroundColor: 'transparent'` - Maintains input background styling

#### Benefits:
- ✅ Fixes transparent text on all mobile browsers
- ✅ Consistent text visibility across all input types
- ✅ Shared code prevents duplication
- ✅ Easy to apply to new inputs
- ✅ Maintains existing styling while fixing visibility
- ✅ Works with autofill and manual input

#### Applied To:
- **Signup form** - Username, email, password, confirm password inputs
- **Login form** - Email and password inputs
- **UserSearchBar** - Search input (mobile and desktop)
- **LocationAutocomplete** - Location search input
- **Profile edit form** - Display name, username, bio textarea, institution, website inputs
- **RichTextEditor** - ContentEditable text area

#### Usage Guidelines:
1. **Always apply to new text inputs** - Use `getCompleteInputStyling()` for all new input elements
2. **Import once per component** - Add the import at the top of components with text inputs
3. **Combine with existing classes** - The utility complements existing Tailwind classes
4. **Test on mobile devices** - Always verify text visibility on iOS Safari and Chrome mobile
5. **Apply to textareas too** - The fix works for both `<input>` and `<textarea>` elements

#### Testing Checklist:
- [ ] Text is visible when typing on iOS Safari
- [ ] Text is visible when typing on Chrome mobile
- [ ] Autofill doesn't make text transparent
- [ ] Placeholder text is visible
- [ ] Cursor/caret is visible
- [ ] Existing styling is preserved

---

## Dropdown Positioning Fixes

### Mobile-First Responsive Dropdown Pattern

**Problem**: Dropdowns on mobile devices often have alignment issues, overflow viewport boundaries, or don't follow consistent positioning patterns.

**Solution**: Use the same responsive positioning pattern as the NotificationSystem dropdown for consistent behavior across all dropdowns.

#### Implementation Pattern:

```tsx
// Mobile-first responsive dropdown with consistent positioning
<div
  className="fixed top-16 left-1/2 transform -translate-x-1/2 w-80 sm:w-96 max-w-[calc(100vw-16px)] bg-white rounded-md shadow-lg border border-gray-200 z-50 max-h-60 overflow-y-auto sm:absolute sm:top-full sm:mt-1 sm:left-0 sm:right-auto sm:transform-none sm:w-full sm:max-w-sm"
  role="listbox"
  aria-label="Dropdown results"
>
  {/* Dropdown content */}
</div>
```

#### Key Classes Breakdown:

**Mobile (< 640px):**
- `fixed top-16 left-1/2 transform -translate-x-1/2` - Fixed positioning, centered horizontally
- `w-80` (320px width) - Consistent width for mobile
- `max-w-[calc(100vw-16px)]` - Prevents viewport overflow with proper margins

**Desktop (≥ 640px):**
- `sm:absolute sm:top-full sm:mt-1` - Absolute positioning below the trigger element
- `sm:left-0 sm:right-auto sm:transform-none` - Left-aligned with the trigger
- `sm:w-full sm:max-w-sm` - Full width of container with max constraint

#### Benefits:
- ✅ Consistent behavior across all dropdowns
- ✅ Proper mobile centering without overflow
- ✅ Desktop alignment with trigger elements
- ✅ Viewport-safe on all screen sizes
- ✅ Accessible and touch-friendly

#### Applied To:
- **UserSearchBar dropdown** - Search results positioning
- **NotificationSystem dropdown** - Notifications panel
- **ProfileDropdown** - User profile menu

#### Usage Guidelines:
1. Always use this pattern for new dropdowns
2. Replace existing dropdown positioning with this pattern when fixing alignment issues
3. Adjust `w-80` and `sm:max-w-sm` values based on content needs
4. Maintain `z-50` or higher for proper layering
5. Include proper ARIA attributes for accessibility

---

## Responsive Design Patterns

### Touch Target Optimization

**Problem**: Interactive elements on mobile devices don't meet the 44px minimum touch target requirement.

**Solution**: Apply consistent touch-friendly classes to all interactive elements.

#### Implementation:
```tsx
// Ensure all interactive elements meet 44px minimum
className="min-h-[44px] min-w-[44px] touch-manipulation"
```

#### Key Classes:
- `min-h-[44px] min-w-[44px]` - Ensures minimum touch target size
- `touch-manipulation` - Optimizes touch interactions
- `active:bg-gray-100` - Provides visual feedback on touch

### Responsive Spacing Pattern

**Problem**: Inconsistent spacing between mobile and desktop layouts.

**Solution**: Use responsive spacing classes consistently.

#### Implementation:
```tsx
// Responsive padding and margins
className="px-3 sm:px-4 py-3 sm:py-4"
className="space-x-1 sm:space-x-3"
className="gap-2 sm:gap-4"
```

---

## Mobile Optimization Techniques

### Viewport Overflow Prevention

**Problem**: Content overflows viewport boundaries on small screens.

**Solution**: Use viewport-aware constraints.

#### Implementation:
```tsx
// Prevent horizontal overflow
className="max-w-[calc(100vw-1rem)]"
className="max-w-[calc(100vw-2rem)]" // For more padding

// Prevent vertical overflow
className="max-h-[70vh] sm:max-h-96"
```

### Sticky Navigation Pattern

**Problem**: Navigation elements disappear when scrolling on mobile.

**Solution**: Use sticky positioning for better mobile UX.

#### Implementation:
```tsx
// Sticky navigation that stays at top
className="sticky top-0 z-40"
```

---

## Database Connection Issues

### PostgreSQL Database Reset for Authentication Problems

**Problem**: PostgreSQL database shows "password authentication failed" errors even when environment variables are correctly set. This happens when the database was initialized with different credentials than the current environment variables.

**Root Cause**: PostgreSQL skips initialization when it finds an existing database directory, using the original credentials from when it was first created.

#### Symptoms:
- Logs show: `PostgreSQL Database directory appears to contain a database; Skipping initialization`
- Continuous `FATAL: password authentication failed for user "postgres"` errors
- Even Railway CLI `railway connect` fails with authentication errors

#### Solution: Reset Database Volume

The database needs to be reset with a fresh volume to reinitialize with current environment variables.

#### Implementation Steps:

1. **Detach the corrupted volume:**
```bash
railway volume detach --volume old-volume-name
```

2. **Create and attach a new volume:**
```bash
railway volume add --name postgres-volume --mount-path /var/lib/postgresql/data
```

3. **Redeploy the database service:**
```bash
railway redeploy
```

4. **Verify initialization in logs:**
```bash
railway logs
# Should show: "PostgreSQL init process complete; ready for start up"
# Should NOT show: "Skipping initialization"
```

#### Benefits:
- ✅ Fresh database initialization with current credentials
- ✅ Resolves authentication failures permanently
- ✅ Maintains data integrity for new deployments
- ✅ Prevents recurring credential mismatches

#### Applied To:
- **Railway PostgreSQL services** - Database authentication issues
- **Docker PostgreSQL containers** - Similar volume reset approach

#### Usage Guidelines:
1. **⚠️ WARNING**: This will delete all existing data in the database
2. Only use for development/staging environments or when data loss is acceptable
3. Always backup important data before resetting volumes
4. Verify environment variables are correct before redeploying
5. Monitor logs to confirm successful initialization

#### Alternative Solutions:
- **For production**: Use `ALTER USER` commands to change passwords instead of volume reset
- **For data preservation**: Export data, reset volume, reimport data

---

## Contributing

When adding new fixes to this document:

1. **Follow the established format**: Problem → Solution → Implementation → Benefits
2. **Include code examples**: Show actual implementation with proper syntax highlighting
3. **Document the benefits**: Explain why this solution is better
4. **List where it's applied**: Help others find existing implementations
5. **Add usage guidelines**: Help developers apply the fix correctly

---

## Related Documentation

- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) - Active issues and their status
- [NAVBAR_ENHANCEMENT_PLAN.md](./NAVBAR_ENHANCEMENT_PLAN.md) - Navbar-specific improvements
- [TEST_GUIDELINES.md](./TEST_GUIDELINES.md) - Testing best practices
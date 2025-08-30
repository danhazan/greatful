# Haptic Feedback Utility

## Overview
This utility provides consistent haptic feedback and touch interaction handling across the application.

## Key Features
- **Haptic Feedback**: Vibration feedback on supported devices with three intensity levels
- **Touch Handlers**: Consistent touch event handling with visual feedback
- **Safety**: Graceful fallbacks for unsupported devices and error handling

## Usage

### Basic Haptic Feedback
```typescript
import { triggerHapticFeedback, buttonHaptic, selectionHaptic } from '@/utils/hapticFeedback'

// Basic usage
triggerHapticFeedback('light')  // 10ms vibration
triggerHapticFeedback('medium') // 20ms vibration
triggerHapticFeedback('heavy')  // 30ms vibration

// Convenience functions
buttonHaptic()     // Light feedback for buttons
selectionHaptic()  // Medium feedback for selections
successHaptic()    // Heavy feedback for success actions
```

### Touch Event Handlers
```typescript
import { createTouchHandlers } from '@/utils/hapticFeedback'

// In your component
<button
  {...createTouchHandlers(undefined, 'light')}
  onClick={handleClick}
>
  Touch me!
</button>

// With custom callback
<button
  {...createTouchHandlers(() => console.log('Touched!'), 'medium')}
  onClick={handleClick}
>
  Touch with callback!
</button>
```

## Important Notes

### Passive Event Listeners
- **DO NOT** call `preventDefault()` in touch event handlers
- React's touch events are passive by default to improve performance
- Use CSS `touch-action: manipulation` instead to prevent zoom

### Browser Support
- Haptic feedback requires `navigator.vibrate()` support
- Gracefully degrades on unsupported devices
- Visual feedback works on all devices

### CSS Classes
Always use these classes on interactive elements:
```css
.touch-manipulation {
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  user-select: none;
}
```

## Error Prevention

### Common Issues Fixed
1. **Passive Event Listener Error**: Removed `preventDefault()` from touch handlers
2. **Visual Feedback Errors**: Added safety checks for DOM manipulation
3. **Zoom Prevention**: Uses CSS `touch-action` instead of `preventDefault()`

### Best Practices
- Always include `touch-manipulation` class on interactive elements
- Use minimum 44px touch targets for accessibility
- Test on actual mobile devices when possible
- Provide visual feedback for all touch interactions

## Components Using This Utility
- `FollowButton`: Light haptic feedback for follow/unfollow actions
- `EmojiPicker`: Medium haptic feedback for emoji selection
- `MentionAutocomplete`: Light haptic feedback for user selection

## Testing
Run the touch interaction tests:
```bash
npm test TouchInteractions.test.tsx
```

All tests verify:
- Touch manipulation classes are applied
- Minimum touch target sizes are met
- Haptic feedback integration works
- No console errors occur during touch events
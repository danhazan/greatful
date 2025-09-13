# Advanced Features

## Keyboard Navigation System

### Overview

This document outlines the advanced keyboard navigation system implemented for dropdown menus and user selection components to enhance accessibility and user experience.

### Improvements Made

#### 1. Custom Hook for Keyboard Navigation

Created `useKeyboardNavigation` hook (`apps/web/src/hooks/useKeyboardNavigation.ts`) that provides:

- **Arrow Key Navigation**: Up/Down arrows to navigate through items
- **Enter/Space Selection**: Select focused items
- **Escape Key**: Close dropdowns
- **Home/End Keys**: Jump to first/last items
- **Automatic Scrolling**: Keeps focused items visible with smooth scrolling
- **Direct Ref Management**: Uses direct element references for reliable scrolling
- **Smart Container Detection**: Automatically finds scrollable containers

#### 2. Enhanced Components

##### MentionAutocomplete
- **Before**: Basic keyboard navigation without scrolling
- **After**: Full keyboard navigation with automatic scrolling to keep focused items visible
- **ARIA Improvements**: Proper `role="listbox"` and `role="option"` attributes
- **Focus Management**: Visual highlighting of selected items

##### LocationAutocomplete  
- **Before**: Basic keyboard navigation without scrolling
- **After**: Full keyboard navigation with automatic scrolling
- **ARIA Improvements**: Added `role="combobox"`, `aria-expanded`, `aria-autocomplete`, `aria-haspopup`
- **Focus Management**: Proper focus ring and selection highlighting

##### ProfileDropdown
- **Before**: Only Escape key support
- **After**: Full arrow key navigation between menu items
- **ARIA Improvements**: Proper `role="menu"` and `role="menuitem"` attributes
- **Focus Management**: Visual highlighting of focused menu items

##### NotificationSystem
- **Before**: No keyboard navigation
- **After**: Arrow key navigation through notifications
- **ARIA Improvements**: Proper `role="list"` and `role="listitem"` attributes
- **Focus Management**: Visual highlighting of focused notifications

##### ShareModal
- **Inherited**: Benefits from MentionAutocomplete improvements for user search
- **Tab Navigation**: Proper tab order within modal
- **Focus Trapping**: Focus stays within modal when open

#### 3. Accessibility Features

##### ARIA Attributes
- `role="listbox"` for dropdown containers
- `role="option"` for selectable items
- `role="menu"` for menu containers
- `role="menuitem"` for menu items
- `role="combobox"` for search inputs
- `aria-selected` for current selection
- `aria-expanded` for dropdown state
- `aria-label` for screen reader descriptions

##### Focus Management
- Visual focus indicators with purple ring (`focus:ring-2 focus:ring-purple-500`)
- Smooth scrolling to keep focused items visible
- Proper focus trapping in modals
- Mouse hover updates keyboard selection

##### Screen Reader Support
- Descriptive ARIA labels for all interactive elements
- Live regions for dynamic content updates
- Proper semantic markup

#### 4. Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ↓ | Navigate to next item |
| ↑ | Navigate to previous item |
| Enter/Space | Select focused item |
| Escape | Close dropdown/modal |
| Home | Jump to first item |
| End | Jump to last item |
| Tab | Navigate between focusable elements |

#### 5. Visual Improvements

- **Focus Rings**: Consistent purple focus rings across all components
- **Hover States**: Mouse hover updates keyboard selection
- **Selection Highlighting**: Clear visual indication of focused items
- **Smooth Scrolling**: Gentle scrolling animations when navigating

#### 6. Testing

Created comprehensive test suite (`apps/web/src/tests/accessibility/keyboard-navigation.test.tsx`) covering:

- ARIA attribute validation
- Keyboard event handling
- Focus management
- Screen reader compatibility
- Cross-component consistency

### Technical Implementation

#### Hook Usage Example

```typescript
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'

const MyDropdown = ({ items, selectedIndex, setSelectedIndex }) => {
  const { setItemRef } = useKeyboardNavigation({
    isOpen: true,
    itemCount: items.length,
    selectedIndex,
    onIndexChange: setSelectedIndex,
    onSelect: () => handleSelection(items[selectedIndex]),
    onClose: () => setIsOpen(false),
    scrollBehavior: 'smooth'
  })

  return (
    <div role="listbox">
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={setItemRef(index)}
          role="option"
          aria-selected={index === selectedIndex}
          className={index === selectedIndex ? 'bg-purple-50' : ''}
          onClick={() => handleSelection(item)}
          onMouseEnter={() => setSelectedIndex(index)}
        >
          {item.name}
        </button>
      ))}
    </div>
  )
}
```

#### Scrolling Behavior

The hook automatically detects when focused items are outside the visible area and scrolls them into view:

1. **Smart Container Detection**: Automatically finds the scrollable container by looking for:
   - `overflow-y: auto` or `overflow-y: scroll` CSS properties
   - Common CSS classes like `overflow-y-auto`, `max-h-60`, `max-h-72`, `max-h-80`

2. **Visibility Check**: Determines if the selected item is visible within the container bounds

3. **Smooth Scrolling**: Uses `scrollIntoView` with smooth behavior when available:
   ```javascript
   selectedItem.scrollIntoView({
     behavior: 'smooth',
     block: 'nearest',
     inline: 'nearest'
   })
   ```

4. **Test Environment Compatibility**: Gracefully handles environments where `scrollIntoView` is not available

### Browser Compatibility

- **Chrome**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Edge**: Full support
- **Mobile**: Touch-friendly with proper touch targets (44px minimum)

### Performance Considerations

- **Debounced Scrolling**: 10ms delay to ensure DOM updates complete
- **Event Delegation**: Efficient keyboard event handling
- **Memory Management**: Proper cleanup of event listeners
- **Smooth Animations**: Hardware-accelerated scrolling

### Future Enhancements

1. **Type-ahead Search**: Jump to items by typing first letters
2. **Multi-selection**: Support for Ctrl+Click and Shift+Click
3. **Custom Scroll Containers**: Support for custom scrollable parents
4. **Virtualization**: Support for large lists with virtual scrolling
5. **RTL Support**: Right-to-left language support

### Conclusion

These improvements significantly enhance the accessibility and usability of dropdown menus throughout the application. Users can now navigate efficiently using only the keyboard, with proper screen reader support and visual feedback. The implementation follows WCAG 2.1 AA guidelines and provides a consistent experience across all dropdown components.
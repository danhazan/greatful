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

---

## Production Database & Performance System

### Overview

This document outlines the advanced database and performance monitoring system implemented for production environments, providing enterprise-grade reliability, monitoring, and optimization capabilities.

### Core Features

#### 1. Environment-Specific Database Configuration

**Connection Pooling by Environment:**

| Environment | Pool Size | Max Overflow | Recycle Time | SSL Required |
|-------------|-----------|--------------|--------------|--------------|
| Development | 5 | 10 | 1 hour | No |
| Staging | 10 | 20 | 1 hour | Yes |
| Production | 20 | 30 | 30 minutes | Yes |

**Production Optimizations:**
- JIT disabled for consistent performance
- Statement cache disabled for production workloads
- Connection timeout controls (60s statement, 30s lock, 300s idle)
- SSL enforcement with configurable modes

#### 2. Automated Backup System

**Backup Types:**
- **Daily Automated Backups**: Compressed, integrity-verified, with retention policies
- **Pre-Migration Backups**: Automatic backup before any database migration
- **On-Demand Backups**: Manual backup creation with custom naming

**Features:**
```python
# Backup configuration
BACKUP_CONFIG = {
    "backup_dir": "/var/backups/grateful",  # Configurable via BACKUP_DIR
    "retention_days": 30,                   # Configurable via BACKUP_RETENTION_DAYS
    "compress": True,                       # gzip compression
    "max_backup_size_gb": 10,              # Size limits
    "backup_timeout_minutes": 60           # Timeout protection
}
```

**Backup Scheduling Options:**
1. **Cron Job (Recommended)**:
   ```bash
   # Daily 2 AM backups
   0 2 * * * cd /path/to/app && python -c "
   import asyncio
   from app.core.database_backup import create_daily_backup
   asyncio.run(create_daily_backup())
   "
   ```

2. **API Endpoints**:
   ```bash
   # Create backup
   POST /api/v1/database/backups
   
   # List backups
   GET /api/v1/database/backups
   
   # Get backup status
   GET /api/v1/database/backups/status
   
   # Cleanup old backups
   DELETE /api/v1/database/backups/cleanup
   ```

#### 3. Migration Management with Rollback

**Safe Migration Features:**
- Automatic backup before migrations
- Rollback testing in temporary databases
- Migration history tracking
- Configurable rollback step limits (max 5 steps by default)

**Migration Commands:**
```bash
# Safe upgrade with backup
python -c "
import asyncio
from app.core.migration_manager import safe_upgrade
result = asyncio.run(safe_upgrade())
print(result)
"

# Safe rollback
python -c "
import asyncio
from app.core.migration_manager import safe_rollback
result = asyncio.run(safe_rollback(steps=1))
print(result)
"

# Test rollback capability
python -c "
import asyncio
from app.core.migration_manager import test_rollback_capability
result = asyncio.run(test_rollback_capability())
print(result)
"
```

**API Endpoints:**
```bash
# Get migration status
GET /api/v1/database/migrations/status

# Get migration history
GET /api/v1/database/migrations/history

# Test rollback (safe)
POST /api/v1/database/migrations/test-rollback

# Admin-only: Upgrade database
POST /api/v1/database/migrations/upgrade

# Admin-only: Rollback database
POST /api/v1/database/migrations/rollback
```

#### 4. Query Performance Monitoring

**Environment-Specific Thresholds:**
```python
SLOW_QUERY_THRESHOLDS = {
    "development": 1.0,  # 1 second
    "staging": 0.5,      # 500ms
    "production": 0.3    # 300ms
}
```

**Automatic Alerting:**
```python
ALERT_THRESHOLDS = {
    "slow_query_rate": 0.1,      # 10% of queries are slow
    "very_slow_query": 5.0,      # Individual query > 5 seconds
    "query_failure_rate": 0.05,  # 5% of queries fail
    "connection_pool_usage": 0.8  # 80% pool utilization
}
```

**Performance Tracking:**
- Real-time query execution monitoring
- Failure rate tracking
- Performance trend analysis (last 60 minutes)
- Alert cooldown to prevent spam (5 minutes)

#### 5. Database Index Monitoring

**Automatic Analysis:**
- **Usage Statistics**: Track index scans, tuples read/fetched
- **Unused Index Detection**: Find indexes consuming space but never used
- **Duplicate Index Identification**: Detect redundant indexes
- **Application-Specific Recommendations**: Tailored suggestions for feed queries, notifications, etc.

**Index Recommendations:**
```sql
-- Automatically suggested for feed performance
CREATE INDEX CONCURRENTLY idx_posts_created_at_desc ON posts (created_at DESC);
CREATE INDEX CONCURRENTLY idx_posts_user_created ON posts (user_id, created_at DESC);

-- Notification optimization
CREATE INDEX CONCURRENTLY idx_notifications_user_created ON notifications (user_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_notifications_unread ON notifications (user_id, created_at DESC) WHERE is_read = false;

-- Relationship optimization
CREATE INDEX CONCURRENTLY idx_follows_follower_id ON follows (follower_id);
CREATE INDEX CONCURRENTLY idx_follows_followed_id ON follows (followed_id);
```

**API Endpoints:**
```bash
# Comprehensive index analysis
GET /api/v1/database/indexes/analysis

# Get recommendations
GET /api/v1/database/indexes/recommendations

# Find unused indexes
GET /api/v1/database/indexes/unused?min_size_mb=1.0
```

#### 6. Production Algorithm Optimization

**Environment-Specific Configuration:**
```python
# Production-optimized settings
'production': {
    'scoring_weights': {
        'hearts': 1.0,
        'reactions': 1.5,
        'shares': 4.0,
        'photo_bonus': 1.5,
        'daily_gratitude_bonus': 2.0,
        'unread_boost': 3.0,
    },
    'cache_settings': {
        'feed_cache_ttl': 300,  # 5 minutes
        'user_preference_cache_ttl': 1800,  # 30 minutes
        'algorithm_config_cache_ttl': 3600,  # 1 hour
        'post_score_cache_ttl': 600,  # 10 minutes
    },
    'query_optimization': {
        'batch_size': 100,
        'max_feed_size': 50,
        'prefetch_relationships': ['user', 'reactions', 'shares'],
        'use_query_hints': True,
    }
}
```

### API Endpoints Summary

#### Database Health & Stats
```bash
GET /api/v1/database/health          # Database health with pool status
GET /api/v1/database/stats           # Comprehensive database statistics
GET /api/v1/database/performance     # Query performance report
```

#### Backup Management
```bash
GET /api/v1/database/backups         # List available backups
POST /api/v1/database/backups        # Create new backup
GET /api/v1/database/backups/status  # Backup system status
DELETE /api/v1/database/backups/cleanup  # Cleanup old backups
```

#### Index Optimization
```bash
GET /api/v1/database/indexes/analysis        # Full index analysis
GET /api/v1/database/indexes/recommendations # Index recommendations
GET /api/v1/database/indexes/unused          # Unused indexes
```

#### Migration Management
```bash
GET /api/v1/database/migrations/status       # Migration status
GET /api/v1/database/migrations/history      # Migration history
POST /api/v1/database/migrations/test-rollback  # Test rollback capability
POST /api/v1/database/migrations/upgrade     # Admin: Upgrade database
POST /api/v1/database/migrations/rollback    # Admin: Rollback database
```

### Monitoring Integration

**Health Check Responses:**
```json
{
  "status": "healthy",
  "database": "connected",
  "pool": {
    "size": 20,
    "checked_in": 18,
    "checked_out": 2,
    "overflow": 0
  },
  "environment": "production"
}
```

**Performance Metrics:**
```json
{
  "summary": {
    "total_queries": 1250,
    "total_execution_time": 45.2,
    "average_query_time": 0.036,
    "slow_queries_count": 12,
    "slow_queries_percentage": 0.96
  },
  "recent_trends": {
    "period_minutes": 60,
    "queries_per_minute": 20.8,
    "success_rate": 0.998,
    "slow_query_rate": 0.008
  }
}
```

### Alert Integration

**Custom Alert Callbacks:**
```python
from app.core.query_monitor import query_monitor

def send_to_datadog(alert_data):
    """Send performance alerts to Datadog."""
    # Integration with monitoring systems
    pass

def send_to_slack(alert_data):
    """Send critical alerts to Slack."""
    # Integration with team notifications
    pass

# Register alert callbacks
query_monitor.add_alert_callback(send_to_datadog)
query_monitor.add_alert_callback(send_to_slack)
```

### Production Deployment

**Required Environment Variables:**
```bash
# Database configuration
DATABASE_URL=postgresql+asyncpg://user:pass@host:port/db?ssl=require
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
DB_SSL_MODE=require

# Backup configuration
BACKUP_DIR=/var/backups/grateful
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESS=true
MAX_BACKUP_SIZE_GB=10

# Performance monitoring
ENVIRONMENT=production
SLOW_QUERY_THRESHOLD=0.3
```

**Recommended Cron Jobs:**
```bash
# Daily backups at 2 AM
0 2 * * * /path/to/scripts/daily_backup.sh

# Weekly index analysis on Sundays at 3 AM
0 3 * * 0 /path/to/scripts/analyze_indexes.sh

# Monthly backup cleanup on 1st at 4 AM
0 4 1 * * /path/to/scripts/cleanup_backups.sh
```

### Performance Benefits

**Development vs Production:**
- **20x connection pool** (20 vs 5 connections)
- **Stricter query thresholds** (300ms vs 1s)
- **Optimized algorithm settings** for production workloads
- **Automatic performance monitoring** with alerting
- **Proactive index recommendations** based on usage patterns

### Security Features

- **SSL enforcement** in production environments
- **Connection parameter validation** and sanitization
- **Backup integrity verification** after creation
- **Admin-only migration endpoints** with authentication
- **Audit logging** for all database operations

### Conclusion

This production database system provides enterprise-grade reliability, performance monitoring, and optimization capabilities. The system is designed to be mostly automatic with manual override capabilities for safety-critical operations. All monitoring and optimization features run continuously without intervention, while backup scheduling and index creation can be automated through standard DevOps practices.
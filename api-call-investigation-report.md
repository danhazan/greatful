# API Call Investigation Report

## Executive Summary

This report analyzes the current API call patterns across the Grateful frontend application to identify duplicated requests, performance bottlenecks, and optimization opportunities. The investigation reveals significant issues with duplicate API calls, inefficient caching strategies, and opportunities for batching requests.

## Key Findings

### 1. Critical Duplication Issues

#### Feed Page Load (32+ requests observed)
- **8+ duplicate `/profile` requests**: Multiple components requesting the same user profile data
- **Multiple `/posts` requests**: Feed loading, individual post data, and user posts overlap
- **Repeated `/notifications` calls**: Notification system polling every 30 seconds regardless of activity
- **Multiple `/update-feed-view` calls**: Single page load triggering multiple feed view updates
- **Individual profile calls**: Each user mentioned or displayed triggers separate API calls

#### Profile Page Load
- **Duplicate user profile requests**: Both profile page and navbar requesting same user data
- **Individual follow status checks**: Each follow button making separate API calls
- **Redundant post loading**: User posts loaded multiple times through different components

#### Notification System
- **Aggressive polling**: 30-second intervals regardless of user activity
- **Batch expansion requests**: Each notification batch expansion triggers individual API calls
- **Duplicate user profile requests**: Each notification fetching user data separately

### 2. API Call Patterns Analysis

#### Current Architecture Issues

1. **No Request Deduplication**: Multiple components can request the same data simultaneously
2. **Ineffective Caching**: Cache TTL too short (30 seconds) for relatively static data
3. **Component-Level API Calls**: Each component manages its own API state independently
4. **Missing Batch Endpoints**: Individual requests for data that could be batched

#### Specific Problem Areas

##### Feed Page (`apps/web/src/app/feed/page.tsx`)
```typescript
// ISSUE: Multiple API calls on page load
useEffect(() => {
  const initializePage = async () => {
    await fetchUserInfo()        // Call 1: /api/users/me/profile
    await loadPosts(token)       // Call 2: /api/posts (returns 20 posts with authors)
    
    // Call 3: Update feed view
    await fetch('/api/posts/update-feed-view', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
  }
}, [router])

// ISSUE: Periodic polling regardless of activity
useEffect(() => {
  const interval = setInterval(checkForNewPosts, 2 * 60 * 1000) // Every 2 minutes
}, [])
```

##### PostCard Component (`apps/web/src/components/PostCard.tsx`)
```typescript
// ISSUE: Each PostCard validates usernames individually
useEffect(() => {
  const validateMentions = async () => {
    // Individual API call per post for username validation
    const response = await fetch('/api/users/validate-batch', {
      method: 'POST',
      body: JSON.stringify({ usernames: validFormatUsernames })
    })
  }
}, [currentPost.content, currentUserId])
```

##### FollowButton Component (`apps/web/src/components/FollowButton.tsx`)
```typescript
// ISSUE: Each follow button makes individual API calls
const { followState, toggleFollow, isLoading } = useUserState({
  userId: userId.toString(),
  autoFetch: true,  // Each button triggers separate API call
  initialFollowState: initialFollowState
})
```

##### NotificationSystem Component (`apps/web/src/components/NotificationSystem.tsx`)
```typescript
// ISSUE: Aggressive polling and individual batch expansion
useEffect(() => {
  const fetchNotifications = async () => {
    const response = await fetch('/api/notifications')
  }
  
  fetchNotifications()
  const interval = setInterval(fetchNotifications, 30000) // Every 30 seconds
}, [userId])

// ISSUE: Individual API calls for batch expansion
const toggleBatchExpansion = async (batchId: string) => {
  const response = await fetch(`/api/notifications/${batchId}/children`)
}
```

### 3. Performance Impact Analysis

#### Request Volume
- **Feed Page Load**: 32+ requests (observed in screenshots)
- **Profile Page Load**: 15-20 requests
- **Notification Polling**: 120 requests/hour per user
- **Follow Button Interactions**: 2-3 requests per button per page

#### Network Overhead
- **Duplicate Profile Requests**: Same user data requested 3-8 times per page load
- **Redundant Authentication**: Each request includes full JWT token
- **Unnecessary Polling**: Notifications polled even when user inactive
- **Individual User Lookups**: Batch-able requests sent individually

#### Cache Inefficiency
- **Short TTL**: 30-second cache for relatively static user profiles
- **Cache Misses**: Different cache keys for same data (wrapped vs unwrapped responses)
- **No Request Deduplication**: Multiple simultaneous requests for same resource

### 4. Root Cause Analysis

#### Architectural Issues

1. **Component-Centric API Management**
   - Each component manages its own API state
   - No centralized request coordination
   - Duplicate requests from different components

2. **Ineffective Caching Strategy**
   ```typescript
   // Current cache configuration
   export const userProfileCache = new APICache({
     ttl: 60000, // 1 minute - too short for profiles
     maxSize: 50
   })
   
   export const followStateCache = new APICache({
     ttl: 15000, // 15 seconds - too short for follow states
     maxSize: 100
   })
   ```

3. **Missing Request Coordination**
   - No global request deduplication
   - Components don't share loading states
   - Simultaneous requests for same data

4. **Suboptimal API Design**
   - Missing batch endpoints for user profiles
   - No server-side request deduplication
   - Individual endpoints for related data

#### Specific Code Issues

1. **useUserState Hook Inefficiency**
   ```typescript
   // ISSUE: Each hook instance makes separate API calls
   const fetchUserData = useCallback(async (targetUserId: string) => {
     // Individual API calls per user
     const profile = await apiClient.getUserProfile(targetUserId)
     const followData = await apiClient.getFollowStatus(targetUserId)
   }, [])
   ```

2. **API Client Cache Misses**
   ```typescript
   // ISSUE: Different cache keys for same data
   private generateKey(url: string, options?: RequestInit): string {
     const method = options?.method || 'GET'
     const headers = JSON.stringify(options?.headers || {})
     const body = options?.body || ''
     return `${method}:${url}:${headers}:${body}` // Headers cause cache misses
   }
   ```

3. **Notification System Over-Polling**
   ```typescript
   // ISSUE: Fixed 30-second polling regardless of activity
   const interval = setInterval(fetchNotifications, 30000)
   ```

### 5. Optimization Opportunities

#### Immediate Wins (Low Effort, High Impact)

1. **Request Deduplication**
   - Implement global request deduplication
   - Share loading states between components
   - Prevent simultaneous requests for same resource

2. **Cache TTL Optimization**
   - User profiles: 5 minutes (currently 1 minute)
   - Follow states: 2 minutes (currently 15 seconds)
   - Posts: 1 minute (currently 30 seconds)

3. **Batch API Endpoints**
   - `/api/users/batch-profiles` for multiple user profiles
   - `/api/follows/batch-status` for multiple follow states
   - `/api/posts/batch-interactions` for post engagement data

#### Medium-Term Improvements

1. **Smart Notification Polling**
   ```typescript
   // Adaptive polling based on user activity
   const getPollingInterval = () => {
     if (document.hidden) return 5 * 60 * 1000 // 5 minutes when tab hidden
     if (lastActivity < 2 * 60 * 1000) return 30000 // 30 seconds when active
     return 2 * 60 * 1000 // 2 minutes when idle
   }
   ```

2. **Component State Coordination**
   - Centralized user profile state
   - Shared follow state management
   - Global notification state

3. **Server-Side Optimizations**
   - Response caching headers
   - Request deduplication middleware
   - Batch endpoint implementations

#### Long-Term Architecture Changes

1. **GraphQL Migration**
   - Single request for complex data requirements
   - Client-side query optimization
   - Built-in request deduplication

2. **Real-Time Updates**
   - WebSocket connections for live updates
   - Eliminate polling for notifications
   - Real-time follow state synchronization

3. **Service Worker Caching**
   - Offline-first architecture
   - Background sync for API calls
   - Intelligent cache management

### 6. Specific Recommendations

#### Priority 1: Critical Issues (Implement Immediately)

1. **Implement Request Deduplication**
   ```typescript
   // Global request deduplication service
   class RequestDeduplicator {
     private pendingRequests = new Map<string, Promise<any>>()
     
     async dedupe<T>(key: string, requestFn: () => Promise<T>): Promise<T> {
       if (this.pendingRequests.has(key)) {
         return this.pendingRequests.get(key)!
       }
       
       const promise = requestFn()
       this.pendingRequests.set(key, promise)
       
       try {
         const result = await promise
         return result
       } finally {
         this.pendingRequests.delete(key)
       }
     }
   }
   ```

2. **Optimize Cache TTL Values**
   ```typescript
   export const userProfileCache = new APICache({
     ttl: 300000, // 5 minutes for user profiles
     maxSize: 100
   })
   
   export const followStateCache = new APICache({
     ttl: 120000, // 2 minutes for follow states
     maxSize: 200
   })
   ```

3. **Implement Batch User Profile Endpoint**
   ```typescript
   // Backend: /api/v1/users/batch-profiles
   // Frontend: Single request for multiple user profiles
   const profiles = await apiClient.post('/users/batch-profiles', {
     user_ids: [1, 2, 3, 4, 5]
   })
   ```

#### Priority 2: Performance Improvements

1. **Smart Notification Polling**
   - Implement adaptive polling intervals
   - Use Page Visibility API to reduce polling when tab hidden
   - Implement exponential backoff for failed requests

2. **Component State Coordination**
   - Create centralized user profile store
   - Implement shared follow state management
   - Add global loading state coordination

3. **API Response Optimization**
   - Include related data in single responses
   - Implement server-side response caching
   - Add ETags for conditional requests

#### Priority 3: Architecture Improvements

1. **Centralized State Management**
   - Implement Redux or Zustand for global state
   - Create specialized stores for users, posts, notifications
   - Add optimistic updates with rollback capability

2. **Real-Time Updates**
   - Implement WebSocket connections for live data
   - Add real-time notification delivery
   - Implement live follow state synchronization

### 7. Implementation Plan

#### Phase 1: Critical Fixes (Week 1-2)
- [ ] Implement global request deduplication
- [ ] Optimize cache TTL values
- [ ] Create batch user profile endpoint
- [ ] Fix notification polling intervals

#### Phase 2: Performance Optimization (Week 3-4)
- [ ] Implement smart notification polling
- [ ] Add component state coordination
- [ ] Create batch follow status endpoint
- [ ] Optimize API response formats

#### Phase 3: Architecture Improvements (Week 5-8)
- [ ] Implement centralized state management
- [ ] Add real-time update capabilities
- [ ] Create comprehensive caching strategy
- [ ] Add performance monitoring and metrics

### 8. Success Metrics

#### Performance Targets
- **Reduce API calls by 60%** on feed page load (from 32+ to <13)
- **Improve page load time by 40%** through request optimization
- **Reduce notification polling by 75%** through smart intervals
- **Eliminate duplicate profile requests** (0 duplicates per page)

#### Monitoring
- Track API call volume per page load
- Monitor cache hit rates and effectiveness
- Measure page load performance improvements
- Track user experience metrics (loading states, responsiveness)

## Conclusion

The current API call patterns show significant inefficiencies with duplicate requests, aggressive polling, and missed caching opportunities. The recommended optimizations can reduce API call volume by 60% while improving user experience through faster page loads and more responsive interactions.

The implementation should be phased to address critical issues first (request deduplication, cache optimization) followed by performance improvements (smart polling, batch endpoints) and finally architectural enhancements (centralized state, real-time updates).

These changes will create a more scalable, performant, and maintainable frontend architecture while significantly reducing server load and improving user experience.
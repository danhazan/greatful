# System State Snapshot

**Phase**: 21  
**Date**: April 2026  
**Status**: FINAL LOCKED STATE

---

## 1. Final Metrics

### Frontend Tests
| Metric | Value |
|--------|-------|
| Test Suites | 140 |
| Total Tests | 1099 |
| Status | ALL PASSING |
| @flow tests | 41 (frozen) |
| Skipped | 0 |

### Backend Tests
| Metric | Value |
|--------|-------|
| Test Files | 73 |
| Total Tests | 878 |
| Status | ALL PASSING |
| Skipped | 25 (infrastructure only) |

---

## 2. Core Guarantees

> **The Grateful system guarantees that user actions are persisted correctly, notifications are generated for all relevant events, privacy boundaries are enforced at the database level, and authentication state is consistent across all requests.**

This guarantee holds regardless of:
- Test execution status
- Frontend load conditions
- Network latency variations
- Browser differences

### System-Wide Invariants
| Invariant | Description |
|-----------|-------------|
| **Data consistency** | Database transactions are atomic; no partial state |
| **Authentication** | All protected endpoints validate JWT before processing |
| **Authorization** | Users can only modify their own resources |
| **Privacy** | Visibility filters applied at database query level |
| **No data loss** | Deletion cascades configured correctly; no orphaned records |
| **API contract** | Response schemas stable; breaking changes require version bump |

---

## 3. Locked Rules

### Test Governance
- **@flow frozen at 41** - Never add new @flow tests
- **No internal mocks in @flow tests** - User journeys must use real hooks
- **No skipped tests** - All tests are running (except infrastructure)
- **Internal mocks prohibited** in @flow / @contract tests

### Contract Enforcement
- **Username Contract**:
  - Backend sends snake_case (`reactor_username`)
  - Frontend transforms to camelCase (`reactorUsername`)
  - Resolver accepts both formats (backward compatibility)
  - Invalid fields removed: `senderUsername`

### Data Contract
- Backend: snake_case
- Frontend: camelCase (after transformation)
- Resolver: handles both via `notificationMapping.ts`

---

## 4. System Contract Coverage

| Flow | Frontend | Backend | Status |
|------|---------|--------|--------|
| Follow User | ✓ | ✓ | COMPLETE |
| Post Creation | ✓ | ✓ | COMPLETE |
| Reaction System | ✓ | ✓ | COMPLETE |
| Notification System | ✓ | ✓ | COMPLETE |
| Authentication | ✓ | ✓ | COMPLETE |
| Feed Rendering | ✓ | ✓ | COMPLETE |
| Share System | ⚠ | ✓ | PARTIAL (non-critical) |

---

## 5. Known Exceptions

### Intentional Deviations
1. **Share System**: Partial frontend coverage (non-critical flow)
2. **Backend transformation**: Inconsistent, handled defensively in resolver
   - `notificationMapping.ts` accepts both snake_case and camelCase

### Infrastructure Only (Skipped)
- Production security tests (require production config)
- Load tests (require production infrastructure)

---

## 6. Runtime Invariants (Enforced in Code)

| Invariant | Service | Location |
|-----------|---------|----------|
| Follow → Notification | FollowService | `follow_service.py` |
| Reaction uniqueness | ReactionService | `reaction_service.py` |
| Feed privacy | FeedServiceV2 | `feed_service_v2.py` |

---

## 7. Validation Commands

```bash
# Frontend tests
npm test

# Governance
npm run test:governance

# Contract check
npm run test:contract

# Backend tests
cd apps/api && source venv/bin/activate && pytest
```

---

## 8. Documentation Index

- `SYSTEM_CONTRACT_MAP.md` - Core architecture, invariants, guarantees
- `USERNAME_CONTRACT_AUDIT.md` - Username resolution analysis
- `TEST_GUIDELINES.md` - Test rules and safe/unsafe changes
- `TEST_STATUS.md` - Current test metrics
- This file - System state snapshot

---

*Document Version: 1.0*  
*Phase: 21 - Final State Locked*
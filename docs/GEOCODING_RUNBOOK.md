# Geocoding Operational Runbook

## Provider Switching

### Switch between LocationIQ and Nominatim

```bash
# Set provider via env var
GEO_PROVIDER=locationiq   # Production default (requires API key)
GEO_PROVIDER=nominatim     # Fallback (no key, may be blocked on shared IPs)
```

**Steps:**

1. Set `GEO_PROVIDER` to desired provider
2. If using LocationIQ, ensure `LOCATIONIQ_API_KEY` is set
3. Adjust `GEO_REQUEST_TIMEOUT` if needed (default: `5.0`)
4. Redeploy the backend (no code changes needed)
5. Verify logs: `"Location search completed"` with the correct `provider` value

### Required Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEO_PROVIDER` | No | `locationiq` | Provider selection: `locationiq` or `nominatim` |
| `LOCATIONIQ_API_KEY` | If `GEO_PROVIDER=locationiq` | — | LocationIQ API key |
| `GEO_REQUEST_TIMEOUT` | No | `5.0` | HTTP request timeout in seconds |

## Key Rotation

### Rotate LOCATIONIQ_API_KEY safely

1. Generate a new API key from [LocationIQ dashboard](https://locationiq.com/console)
2. Update `LOCATIONIQ_API_KEY` env var to the new key
3. Redeploy the backend
4. Verify logs show successful `"LocationIQ search succeeded"` entries with `upstream_status_code: 200`
5. Revoke the old API key from LocationIQ dashboard (after confirming traffic on the new key)

**No downtime**: The rotation is a simple env var swap — the provider is stateless and picks up the key on the next request.

## Failure Modes

### 401 — `upstream_unavailable`

- **Cause**: `LOCATIONIQ_API_KEY` is invalid, expired, or revoked
- **Log signature**: `"LocationIQ returned 401 (invalid API key)"`
- **User impact**: All location searches fail with 502
- **Action**: Verify API key, rotate if needed, or switch to Nominatim fallback

### 429 — `rate_limited`

- **Cause**: LocationIQ free tier exhausted (5000 req/day) or burst limit exceeded
- **Log signature**: `"LocationIQ returned 429 (rate limited)"`
- **User impact**: Searches fail with 502 until rate window resets
- **Action**: Wait for reset, upgrade LocationIQ tier, or switch to Nominatim fallback
- **Note**: 429 is **never retried** — it is a hard limit, not a transient error

### 502/503/504 — `upstream_unavailable`

- **Cause**: LocationIQ or Nominatim service outage, network issue, or Railway egress instability
- **Log signature**: `"LocationIQ returned 502 (attempt 1/2)"` or `"LocationIQ returned unexpected status: 5xx"`
- **User impact**: Searches may fail; retries may succeed if transient
- **Action**: Check [LocationIQ status](https://status.locationiq.com/), verify network connectivity, or switch to Nominatim fallback if provider-wide outage
- **Note**: Retried twice with exponential backoff (1s, 2s) before surfacing error

### Timeout — `request_failed` (504)

- **Cause**: Upstream provider is slow or unreachable, or default `GEO_REQUEST_TIMEOUT` is too low
- **Log signature**: `"TimeoutException"` or `"ConnectError"` in provider logs
- **User impact**: Searches return 504 after retries are exhausted
- **Action**: Increase `GEO_REQUEST_TIMEOUT`, check provider status, or switch providers

## Rollback

### Switch from LocationIQ to Nominatim

```
1. Set GEO_PROVIDER=nominatim
2. Remove/unset LOCATIONIQ_API_KEY (not required for Nominatim)
3. Redeploy backend
4. Verify logs: "Location search completed" with provider="NominatimProvider"
```

**Nominatim caveats:**

- No API key required — works immediately on deploy
- Free and unlimited but subject to OSM fair-use policy
- May be blocked on shared/cloud outbound IPs (the original problem this runbook solves)
- Not rate-limited in the same way, but can return 429 under aggressive usage

## Monitoring

### Recommended Alerts

| Alert | Condition | Suggested Threshold | Action |
|---|---|---|---|
| Upstream error spike | `upstream_error` in endpoint logs | >5 failures in 5 minutes | Check provider status, consider rollback |
| Elevated latency | `latency_ms` in location logs | >2000ms p95 | Check network, adjust timeout, switch providers |
| Repeated rate-limiting | `rate_limited` constraint | >3 occurrences in 1 hour | Wait for reset, upgrade tier, or switch to Nominatim |
| Quota exhaustion | 429 responses from LocationIQ | Any occurrence during peak hours | Monitor daily req count, upgrade LocationIQ tier if needed |

### Log Patterns

Successful search:
```
"Location search completed" provider="LocationIQProvider" latency_ms=342 result_count=5
```

Rate-limited:
```
"LocationIQ returned 429 (rate limited)" upstream_status_code=429
```

Upstream failure after retries:
```
"LocationIQ returned 502 (attempt 1/2)" upstream_status_code=502 retry_attempt=1
"LocationIQ returned 502 (attempt 2/2)" upstream_status_code=502 retry_attempt=2
# then UpstreamServiceError raised
```

Timeout exhausted:
```
"ConnectError exhausted after 2 retries" query="New York"
# then UpstreamServiceError raised with status_code=504
```

## Frontend Behavior

### Current
- **Debounce**: 300ms `setTimeout`/`clearTimeout` in `LocationAutocomplete.tsx` — prevents excessive requests during rapid typing
- **Min query length**: 2 characters (enforced both client-side and server-side)
- **Request cancellation**: **Not implemented** — in-flight `fetch` requests are not aborted when the user types faster than 300ms. Stale responses can race with newer ones.
- **API route**: Frontend proxies through `/api/users/location/search` (Next.js route handler) to the backend

### Recommended Follow-up
Add `AbortController`-based request cancellation to `LocationAutocomplete.tsx`:
- Creates a new `AbortController` before each `fetch`
- Calls `abortController.abort()` in `handleInputChange` when the query changes
- Discards aborted responses in the `catch` block (swallow `AbortError`)

This is important because quota-backed providers (LocationIQ: 5000 req/day) make aggressive autocomplete patterns expensive even with debounce.

## Future Improvements

The following are intentionally **not implemented** in the current round but are documented for future consideration:

- **Lightweight TTL caching**: Cache recent search results client-side or at the API route level. Reduces duplicate upstream calls for frequently-searched terms (e.g., "New York", "London").
- **Quota monitoring**: Track daily request count against LocationIQ limit (5000 req/day). Alert or auto-switch to Nominatim fallback when approaching quota.
- **Reverse geocoding support**: Add a `reverse_geocode(lat, lon)` method to the GeocoderProvider protocol for converting coordinates to addresses.
- **Request deduplication**: Use the existing `requestDeduplicator.ts` utility (or a backend equivalent) to collapse concurrent identical queries to a single upstream call.
- **Multi-provider failover**: Chain providers so that if LocationIQ returns 429 or 5xx, Nominatim is tried automatically before surfacing an error. Requires careful quota accounting and latency budgeting.
- **Cached provider instance**: Currently each `LocationService` creates a new provider instance via `create_provider()`. A singleton or cached provider would reuse the same HTTP client across requests.

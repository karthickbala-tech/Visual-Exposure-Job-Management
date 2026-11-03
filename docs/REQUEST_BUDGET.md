# Request budget (Catalyst demo plan)

The Development project runs on a demo plan with small allowances. Counts seen on 3 Nov 2026 (used / allowed): Data Store fetch 1,279 / 10,000; insert 76 / 5,000; update 33 / 1,000; delete 0 / 1,000; Cache get 376 / 1,000; Cache put 67 / 5,000; Stratus upload 1 / 1,000; Mail 0 / 100; API Gateway 0 / 100,000; Web client fetch 78 / 300,000.

The tight ones: **Cache get (1,000), Data Store update (1,000), Mail (100), Data Store fetch (10,000)**. Every rule below exists to protect them.

## Cost of one API request (after the 3 Nov 2026 audit)

| Step | Before | Now |
|---|---|---|
| Who is calling (person row) | 1 fetch every request | 1 fetch per person per minute per warm instance (in-process memo) |
| Permission matrix | 1 Cache get every request | 0 on a warm instance (5-minute memo), else 1 Cache get |
| Company dashboard figures (4 queries) | 1 Cache get per dashboard view | 0 on a warm instance (60-second memo), else 1 Cache get |
| Page itself | its own queries | unchanged, each list is one query, related rows fetched in one `IN (...)` query |

## Rules for backend code

1. **No query inside a loop.** Fetch related rows with one `IN (...)` query (`inList`), then match in memory.
2. **Batch writes.** `insert` and `update` accept arrays: one call for many rows. Only write per row when each write must succeed or fail on its own (for example, one email sent, then record it).
3. **Read once, reuse.** A service that needs the same row twice passes it down instead of fetching again.
4. **Cache through `lib/caches.js`** (in-process, bounded, short time limit) in front of the Cache segment. Services that change cached data clear it.
5. **Scheduled work must be cheap when idle.** A job that wakes every few minutes costs at least one fetch each time (288 a day at 5 minutes). Schedule only what has something to do; pause schedules for features that are not live.
6. **Email is scarce (100 a month).** One message per event with all recipients in `to`; never one message per recipient.
7. **Every list is paginated and capped** (300 rows maximum per query).

## Rules for the web app

- No polling and no refetch on window focus or reconnect.
- A failed request is retried once, never for a refusal (400, 401, 403, 404).
- One shared query per resource (`useMe` is used everywhere and fetched once).

## Schedules (Development)

| Schedule | State |
|---|---|
| `compliance_due_daily` (07:00 Melbourne) | on: about 30 runs a month |
| `drain_outbox_5min` | **off** until the CRM connection exists. Switch it on later as **hourly**, not every 5 minutes, and have enqueue trigger a drain when it matters |

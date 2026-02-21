# Schema Impact and Integration Risk

## Immediate impact (for current requested in-memory phase)
- No required DB schema change.
- No required change to existing `usage_events` table.

## Current implementation impact points
Potentially impacted components:
1. `POST /api/chat/respond` request contract
   - current contract expects `messages[]`.
   - changing this directly would break current frontend.
2. frontend chat send path (`src/pages/ChatPage.tsx`)
   - currently assembles and sends full transcript each turn.
3. validation layer (`worker/src/validation.ts`)
   - currently enforces rules over full `messages[]` input.

## Safe integration strategy (recommended)
- Keep current `/api/chat/respond` contract initially.
- Add tiered-memory internals behind feature flag:
  - `ENABLE_TIERED_MEMORY=true/false`
- Optional future endpoint:
  - `/api/chat/respond-v2` for minimal payload mode.

## If persistence is added later
Prefer separate table namespace to avoid conflicts with usage telemetry:
- `memory_sessions`
- `memory_turn_log`
- `memory_base_truth`

This avoids coupling with `usage_events` and allows independent retention policy.

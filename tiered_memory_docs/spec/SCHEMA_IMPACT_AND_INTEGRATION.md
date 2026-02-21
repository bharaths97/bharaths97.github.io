# Schema Impact and Integration Risk

Updated: 2026-02-21

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
- Summarizer/runtime memory tuning flags now supported:
  - `OPENAI_SUMMARIZER_MODEL`
  - `OPENAI_SUMMARIZER_TEMPERATURE`
  - `OPENAI_SUMMARIZER_TIMEOUT_MS`
  - `OPENAI_SUMMARIZER_MAX_OUTPUT_TOKENS`
  - `TIERED_MEMORY_SUMMARIZER_PROMPT`
  - `MEMORY_MAX_BASE_TRUTH_ENTRIES`
  - `MEMORY_MAX_TURN_LOG_ENTRIES`
  - `MEMORY_MAX_RAW_WINDOW_MESSAGES`
  - `MEMORY_MAX_FACT_CHARS`
  - `MEMORY_MAX_SUMMARY_CHARS`
  - `MEMORY_MAX_RAW_MESSAGE_CHARS`
- Optional future endpoint:
  - `/api/chat/respond-v2` for minimal payload mode.

## If persistence is added later
Prefer separate table namespace to avoid conflicts with usage telemetry:
- `memory_sessions`
- `memory_turn_log`
- `memory_base_truth`

This avoids coupling with `usage_events` and allows independent retention policy.

## Current branch integration checkpoint
- `/api/chat/respond`:
  - unchanged request/response contract
  - when memory flag enabled, backend updates in-memory state asynchronously after chat response
- `/api/chat/reset`:
  - now also clears in-memory state for authenticated `session_id + user_id`
- No frontend schema changes required for current Phase A path.

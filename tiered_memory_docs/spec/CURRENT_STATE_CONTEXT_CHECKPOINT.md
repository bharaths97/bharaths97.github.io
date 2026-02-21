# Current-State Context Checkpoint (Facts Only)

## Current chat pipeline
1. Frontend stores transcript in sessionStorage keyed by `session_id`.
2. On each send, frontend posts full `messages[]` context + latest user message, plus session-locked `use_case_id` and `memory_mode`.
3. Worker validates auth/session/limits.
4. Worker resolves selected system prompt profile.
5. Worker calls OpenAI chat completions with:
   - system message = selected base prompt
   - truncated message history = last `MAX_CONTEXT_MESSAGES`
6. Worker returns assistant text + usage.
7. If `ENABLE_TIERED_MEMORY=true`, worker asynchronously updates in-memory tiered memory for that authenticated session.

## Where this lives
- Frontend send flow: `src/pages/ChatPage.tsx`
- Frontend storage: `src/lib/chatSessionStore.ts`
- Worker routing/respond: `worker/src/index.ts`
- OpenAI call: `worker/src/openai.ts`
- Prompt profile resolution: `worker/src/prompts/index.ts`

## Session model today
- Session identity is derived in worker from Access claims (`deriveSessionId`).
- Frontend transcript persistence is browser-side only.
- Server-side conversation memory is available in-memory only (per worker instance) when tiered mode is enabled.
- `/api/chat/reset` clears session-scoped in-memory memory state.

## Existing system prompt usage
- Prompt profiles are server-side, chosen by `use_case_id` and session-locked.
- Chat inference always prepends one system prompt from chosen profile.
- Tiered memory uses markdown-backed prompt/template assets:
  - `worker/src/memory/prompts/Summarizer.md`
  - `worker/src/memory/prompts/ChatContextTemplate.md`
- Runtime config is centralized through `worker/src/runtimeConfig.ts`.

## Existing admin/usage data path
- Worker writes usage telemetry to D1 `usage_events` table.
- Admin endpoint reads aggregates from D1.
- Chat page only consumes `session.capabilities.control_center` boolean.

## Best insertion point for tiered summarizer
- Implemented in `worker/src/index.ts`, within `/api/chat/respond` after assistant reply is produced.
- Runs async via `ctx.waitUntil(...)` when available, with per-session locking.

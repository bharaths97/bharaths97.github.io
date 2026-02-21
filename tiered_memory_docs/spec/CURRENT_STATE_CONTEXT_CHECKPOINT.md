# Current-State Context Checkpoint (Facts Only)

## Current chat pipeline
1. Frontend stores transcript in sessionStorage keyed by `session_id`.
2. On each send, frontend posts full `messages[]` context + latest user message.
3. Worker validates auth/session/limits.
4. Worker resolves selected system prompt profile.
5. Worker calls OpenAI chat completions with:
   - system message = selected base prompt
   - truncated message history = last `MAX_CONTEXT_MESSAGES`
6. Worker returns assistant text + usage.

## Where this lives
- Frontend send flow: `src/pages/ChatPage.tsx`
- Frontend storage: `src/lib/chatSessionStore.ts`
- Worker routing/respond: `worker/src/index.ts`
- OpenAI call: `worker/src/openai.ts`
- Prompt profile resolution: `worker/src/prompts/index.ts`

## Session model today
- Session identity is derived in worker from Access claims (`deriveSessionId`).
- Frontend transcript persistence is browser-side only.
- No server-side conversation memory is currently persisted.

## Existing system prompt usage
- Prompt profiles are server-side, chosen by `use_case_id` and session-locked.
- Chat inference always prepends one system prompt from chosen profile.

## Existing admin/usage data path
- Worker writes usage telemetry to D1 `usage_events` table.
- Admin endpoint reads aggregates from D1.
- Chat page only consumes `session.capabilities.control_center` boolean.

## Best insertion point for tiered summarizer
- In `worker/src/index.ts`, within `/api/chat/respond` after assistant reply is produced.
- To avoid user latency impact, summarizer phase should be async/queued per session.

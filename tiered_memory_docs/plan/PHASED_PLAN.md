# Tiered Memory Phased Plan

Updated: 2026-02-21

Primary planning references:
- `tiered_memory_docs/plan/TIERED_PLAN_MASTER.md`
- `tiered_memory_docs/plan/TIERED_PROGRESS_TRACKER.md`

## Phase A: In-memory prototype (this branch)
Section mapping reference:
- `tiered_memory_docs/plan/PHASE_A_GUIDE_MAPPING.md`

Current status:
- Completed: per-session in-memory store (`baseTruth`, `turnLog`, `rawWindow`) under `worker/src/memory/store.ts`
- Completed: diff normalization + application pipeline (`remove -> update -> add`) in `worker/src/memory/diff.ts`
- Completed: per-session async lock in `worker/src/memory/locks.ts`
- Completed: feature flag/config gate in `worker/src/memory/config.ts`
- Completed: summarizer policy + prompt scaffolding in `worker/src/memory/policy.ts` and `worker/src/memory/prompts/*`
- Completed: prompt assets moved to markdown-backed templates (`worker/src/memory/prompts/Summarizer.md`, `worker/src/memory/prompts/ChatContextTemplate.md`)
- Completed: summarizer caller + fallback path in `worker/src/memory/summarizer.ts`
- Completed: `/api/chat/respond` integration path (async memory update after reply) in `worker/src/index.ts`
- Completed: `/api/chat/reset` memory clear integration in `worker/src/index.ts`
- Completed: centralized worker runtime config composition in `worker/src/runtimeConfig.ts` (limits + ai + memory)
- Completed: worker tests for store/diff/lock and respond/reset integration in `worker/test/memory/*.spec.ts`

Phase A remaining for sign-off:
- Pending: explicit unit tests for summarizer malformed JSON/retry/fallback behavior
- Pending: explicit adversarial tests for poisoning controls and unsafe fact patterns
- Pending: capture benchmark baseline (token + latency) before/after tiered mode
- Pending: write Phase A acceptance report with pass/fail evidence

Manual validation available now:
- `/api/chat/session` returns `memory_modes`, `selected_memory_mode`, and `use_case_locked`.
- First message locks `use_case_id + memory_mode`; subsequent attempts to switch are rejected.
- Tiered mode (`ENABLE_TIERED_MEMORY=true`) updates session memory asynchronously and keeps user-facing reply latency stable.
- `/api/chat/reset` clears in-memory state for current `session_id + user_id`.

## Phase B: Performance evaluation
- Run benchmark prompts and compare with baseline:
  - token usage
  - latency
  - answer quality on cross-turn references
- Record results in this folder.
- Run security regression suite against Phase A build and record pass/fail with logs.

## Phase C: Migration decision
- Decide whether to:
  - keep contract-compatible mode, or
  - move to minimal payload endpoint.

## Phase D: Optional persistence
- Introduce D1-backed memory tables + TTL cleanup.
- Keep usage telemetry schema unchanged.
- Re-run full security suite with persistence enabled (session expiry, stale-read, and deletion guarantees).

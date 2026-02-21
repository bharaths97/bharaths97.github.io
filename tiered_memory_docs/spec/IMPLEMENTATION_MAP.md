# Tiered Memory Implementation Map

## Objective
Implement two-layer memory per session:
- `baseTruth` (mutable facts/constraints)
- `turnLog` (append-only compressed turn summaries)
- plus `rawWindow` (last N verbatim messages)

## Required response contract from summarizer model
Expected JSON:
```json
{
  "user_summary": "...",
  "assistant_summary": "...",
  "base_truth_diff": {
    "add": [],
    "update": [],
    "remove": []
  }
}
```

Updated: 2026-02-21

## Workstreams

### W1. Memory runtime layer (backend)
Status: Implemented

Implemented module set under `worker/src/memory/`:
- `store.ts`
  - per-session in-memory store
  - structure: `baseTruth[]`, `turnLog[]`, `rawWindow[]`, `revision`, `expiresAt`
- `diff.ts`
  - apply `remove -> update -> add`
- `policy.ts`
  - short/medium/long/code-heavy routing
  - raw window eviction rules
- `locks.ts`
  - per-session async mutex (prevent phase race)

### W2. Summarizer integration
Status: Implemented (baseline)

Implemented in `worker/src/memory/summarizer.ts`:
- separate model selection (env var)
- strict JSON-only parse + fallback path
- timeout + retry-once behavior

### W3. Respond flow changes
Status: Implemented

In `worker/src/index.ts` (`POST /api/chat/respond`):
- Phase 1 (chat):
  - build context from `baseTruth + turnLog + rawWindow + latest user`
  - call chat model and return answer
- Phase 2 (memory update):
  - summarizer on `(user_raw, assistant_raw)`
  - apply diff to baseTruth
  - append turn summary
  - update rawWindow

### W4. Prompt templates
Status: Implemented

- `worker/src/memory/prompts/ChatContextTemplate.md`
- `worker/src/memory/prompts/Summarizer.md`
- `worker/src/memory/prompts/chatContext.ts`
- `worker/src/memory/prompts/summarizer.ts`

### W4.1 Runtime config centralization
Status: Implemented

- `worker/src/runtimeConfig.ts`
- `worker/src/index.ts` now consumes one composed runtime config object (limits + AI + memory) instead of scattered config reads.

### W5. Observability and performance
Status: Partially implemented

Implemented:
- log events for memory updates/failures in `worker/src/index.ts` (`memory.turn.updated`, `memory.turn.update_failed`)

Pending:
- metrics per turn:
  - chat latency
  - summarizer latency
  - summarizer failure rate
  - baseTruth size, turnLog length, rawWindow length
- logging: no raw content in production logs

### W6. Frontend contract strategy
Status: Implemented (non-breaking mode)

Two options:
- Non-breaking phase: keep current `messages[]` API while backend starts internal memory maintenance.
- Migration phase: switch to minimal payload (`message`) once server-memory is proven.

### W7. Security testing and hardening
Status: In progress

- Add explicit guards in summarizer pipeline:
  - strict JSON schema validation for summarizer output
  - max-length clamps on summaries and diff arrays
  - reject/neutralize control instructions embedded in summary fields.
- Add abuse checks for in-memory store:
  - per-session quotas (max turns, max baseTruth entries, max rawWindow size)
  - TTL enforcement and stale session eviction.
- Add isolation checks:
  - session key must always be bound to authenticated `session_id` + identity.
- Add red-team style test prompts:
  - memory poisoning attempts
  - instruction smuggling into diff entries
  - attempts to insert synthetic identities, roles, or policy overrides.

## Suggested file-level change list
- `worker/src/index.ts` (updated)
- `worker/src/types.ts` (updated env contract)
- `worker/src/memory/*` (added)
- `worker/test/memory/*.spec.ts` (added)

## Performance experiment checkpoints
1. Baseline: current full-history flow latency + token usage.
2. Tiered memory (no persistence), N=6 raw window.
3. Compare:
   - prompt token reduction
   - p50/p95 latency
   - answer consistency on reference-heavy prompts.

## Security experiment checkpoints
1. Summarizer integrity:
   - malformed JSON handling, retry, fallback path.
2. Memory isolation:
   - no read/write across users or mismatched sessions.
3. Poisoning resistance:
   - baseTruth remains policy-safe under adversarial prompts.
4. Logging hygiene:
   - no raw prompt/reply leakage in structured logs.

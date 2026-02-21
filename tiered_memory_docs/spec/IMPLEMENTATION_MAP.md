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

## Workstreams

### W1. Memory runtime layer (backend)
Add new module set under `worker/src/memory/`:
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
Add `worker/src/memory/summarizer.ts`:
- separate model selection (env var)
- strict JSON-only parse + fallback path
- timeout + retry-once behavior

### W3. Respond flow changes
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
- `worker/src/memory/prompts/chat-context.ts`
- `worker/src/memory/prompts/summarizer.ts`

### W5. Observability and performance
- metrics per turn:
  - chat latency
  - summarizer latency
  - summarizer failure rate
  - baseTruth size, turnLog length, rawWindow length
- logging: no raw content in production logs

### W6. Frontend contract strategy
Two options:
- Non-breaking phase: keep current `messages[]` API while backend starts internal memory maintenance.
- Migration phase: switch to minimal payload (`message`) once server-memory is proven.

### W7. Security testing and hardening
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
- `worker/src/index.ts`
- `worker/src/types.ts`
- `worker/src/openai.ts` (if adding structured output helpers)
- new: `worker/src/memory/*`
- new tests: `worker/test/memory/*.spec.ts`

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

# Tiered Memory Security Test Plan

Updated: 2026-02-21

## Scope
Security testing for the isolated tiered-memory implementation track.

## Test Groups

### 1) Auth/session isolation
- Verify memory store keying is bound to authenticated `session_id`.
- Attempt replay with mismatched `session_id`; expect reject.
- Attempt cross-user read/write with valid token from another user; expect reject.
Status:
- Partially implemented in tests (`worker/test/memory/store.spec.ts`, `worker/test/memory/respondMemory.spec.ts`).
- Cross-user integration adversarial test still pending.

### 2) Summarizer output integrity
- Force malformed JSON from summarizer mock; verify retry then fallback path.
- Return oversized summary fields; verify clamp/reject behavior.
- Return unexpected keys/types; verify strict schema guard.
Status:
- Pending dedicated tests for malformed/hostile summarizer outputs.

### 3) Memory poisoning resistance
- User prompt tries to inject fake constraints into base truth.
- User prompt tries role escalation memory (e.g., “admin approved”).
- Verify applied diff filters do not persist unsafe policy-changing statements.
Status:
- Pending dedicated red-team tests (manual + mocked summarizer responses).

### 4) Race/ordering safety
- Simulate rapid consecutive turns for same session.
- Verify per-session lock preserves order and prevents state corruption.
- Confirm no lost updates in `baseTruth` and `turnLog`.
Status:
- Implemented at unit level in `worker/test/memory/locks.spec.ts`.
- Pending high-concurrency integration stress case.

### 5) Resource abuse controls
- Exceed per-session memory quotas (turn count, base-truth entries, raw-window cap).
- Verify bounded memory growth and graceful degradation.
- Verify stale session eviction by TTL.
Status:
- Partially implemented (store caps + eviction validated in `worker/test/memory/store.spec.ts`).
- Pending long-run stress profile and memory pressure tests.

### 6) Logging hygiene
- Verify logs never include raw user/assistant message content.
- Verify only operational metadata and redacted fields are emitted.
Status:
- Partially implemented: memory logs emit metadata only in `worker/src/index.ts`.
- Pending explicit assertion tests over emitted log payloads.

## Pass Criteria
- No cross-session memory access.
- No unsafe diff entries committed to base truth.
- Summarizer failures degrade safely without service crash.
- Memory remains bounded under abuse tests.
- Logs remain content-safe.

## Execution Stages
- Stage A: unit tests (diff validator, schema parser, lock behavior).
- Stage B: integration tests (`/respond` + summarizer pipeline).
- Stage C: manual adversarial tests in dev deployment.

## Current Evidence Snapshot
- Implemented and passing locally:
  - `worker/test/aiConfig.spec.ts`
  - `worker/test/memory/store.spec.ts`
  - `worker/test/memory/diff.spec.ts`
  - `worker/test/memory/locks.spec.ts`
  - `worker/test/memory/respondMemory.spec.ts`
  - latest full worker suite: `10` files, `30` tests passing
- Remaining before Phase A security sign-off:
  - summarizer malformed/poisoned output tests
  - cross-user adversarial integration tests
  - logging hygiene assertions

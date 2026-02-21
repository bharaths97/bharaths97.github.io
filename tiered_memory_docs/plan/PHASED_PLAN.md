# Tiered Memory Phased Plan

## Phase A: In-memory prototype (this branch)
- Build per-session memory store + summarizer pipeline.
- Keep existing API contract for frontend compatibility.
- Add feature flag gate.
- Add regression tests for:
  - diff apply correctness
  - summarizer failure fallback
  - session isolation
  - race lock behavior.
- Add security tests for:
  - memory poisoning via malicious user prompts
  - summarizer malformed JSON and prompt-injection attempts
  - unauthorized cross-session memory access attempts
  - lock bypass/race condition abuse patterns.

## Phase B: Performance evaluation
- Run benchmark prompts and compare with baseline:
  - token usage
  - latency
  - answer quality on cross-turn references.
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

# Tiered Memory Architecture (Isolated Track)

Branch: `tiered-memory-architecture`

This folder is the isolated documentation track for tiered-memory experimentation and performance evaluation.

Status checkpoint (2026-02-21):
- Phase A implementation is in progress with memory runtime scaffolding, respond/reset integration, markdown-backed prompt templates, and centralized runtime config wired.
- Planning and security docs in `plan/` and `spec/` are updated to reflect implemented vs pending items.

## Structure
- `input/`
  - source requirement/research guides
- `spec/`
  - technical architecture + implementation mapping
- `plan/`
  - phased execution and checkpoints
  - security test plan and gates
  - canonical plan and progress tracker

## Scope Boundary
- This track does not modify the existing `docs/` folder.
- Existing chat/admin production-hardening work is considered frozen until this track is complete.

## Source Inputs Used
- `tiered_memory_docs/input/tiered_memory_architecture_guide.md`
- `tiered_memory_docs/input/memory_system_codebase_prompt.md`

Note: `tiered_momory_architecture_guide.md` (typo variant) was not present.

## Primary Tracking Docs
- Canonical plan: `tiered_memory_docs/plan/TIERED_PLAN_MASTER.md`
- Progress tracker: `tiered_memory_docs/plan/TIERED_PROGRESS_TRACKER.md`
- Phase map: `tiered_memory_docs/plan/PHASED_PLAN.md`
- Security plan: `tiered_memory_docs/plan/SECURITY_TEST_PLAN.md`

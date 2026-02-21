# Tiered Memory Architecture — Implementation Guide
*Dual-layer context management for LLM chat systems*

---

## 1. Overview

This guide covers how to implement a two-layer memory system for an LLM-backed chat application. Instead of passing raw message history — which exhausts context windows — or naively summarizing everything with the same model that is doing the chatting, this architecture uses a dedicated, higher-capability model purely for memory management.

The system separates memory into two complementary structures maintained in-memory on your backend (persistence can be added later):

- **Base Truth Document** — A living record of established facts, constraints, goals, and hard exceptions. Gets mutated (not appended) after each turn.
- **Turn Log** — An append-only list of compressed summaries of what was asked and answered each turn.

> **Why separate models?** Asking the chat model to summarize itself in the same inference pass creates a cognitive conflict: it is generating an answer and deciding what to remember simultaneously, under time pressure, without knowing what the user will reference later. A dedicated summarizer with the full exchange in front of it — and a system prompt tuned purely for compression quality — produces materially better memory artifacts.

---

## 2. Architecture

### 2.1 Data Structures

Maintain the following on your backend server for each conversation session:

```js
// In-memory session store (per conversation)
const session = {
  baseTruth: [],      // Array of string facts, mutated each turn
  turnLog: [],        // Append-only array of turn summary objects
  rawWindow: [],      // Last N full messages (sliding window)
};
```

### 2.2 Turn Summary Object

Each entry in the turn log takes this shape:

```json
{
  "turn": 4,
  "user_summary": "Asked to refactor the sorting function to be iterative",
  "assistant_summary": "Provided iterative quicksort, explained stack vs. recursion tradeoff",
  "base_truth_diff": {
    "add": ["User prefers iterative over recursive solutions"],
    "update": ["Sorting function: now iterative quicksort, O(n log n)"],
    "remove": ["User open to recursive approaches"]
  }
}
```

---

## 3. Request Flow

Every user message triggers a two-phase process: chat inference first, then memory update.

### Phase 1 — Chat Inference

1. Inject current base truth and turn log into the chat model's system prompt.
2. Include the last N raw messages (recommended: 5–8 turns) as the conversation history for precise short-term reference.
3. Send user message. Stream or return response to user immediately.

### Phase 2 — Memory Update (after reply is sent)

1. Fire a separate API call to the summarizer model with the raw user message and raw assistant reply.
2. Summarizer returns a turn summary object including the `base_truth_diff`.
3. Apply the diff to base truth: add new facts, find-and-replace updated ones, remove stale ones.
4. Append turn summary (without the diff) to the turn log.
5. Add the raw exchange to the raw window; evict oldest if window exceeds N.

> **Blocking vs. Async** — Run Phase 2 async so the user gets their reply without waiting for the summarizer. The risk is a race condition if the user sends a follow-up before the summary for the previous turn is applied. Mitigate with a per-session lock: queue the next inference if the summarizer is still running for the prior turn. For most conversational pacing this is a non-issue, but fast automated pipelines need it.

---

## 4. Prompt Engineering

### 4.1 Chat Model System Prompt Template

```
You are a helpful assistant.

## Established Facts & Constraints
{{baseTruth.map(f => `- ${f}`).join('\n')}}

## Conversation History Summary
{{turnLog.map(t =>
  `Turn ${t.turn}: User: ${t.user_summary} | You: ${t.assistant_summary}`
).join('\n')}}

The recent messages below are the verbatim exchange. Rely on them
for precise detail. The summary above is context for older turns.
```

### 4.2 Summarizer System Prompt

This is the most important prompt to engineer carefully. It determines the quality of your memory.

```
You are a memory manager for a conversation system.
You will receive a single user message and an assistant reply.
Your job: extract a compressed, high-fidelity memory artifact.

Rules:
- user_summary: ≤25 words. Capture intent + key specifics (types, names, constraints).
- assistant_summary: ≤30 words. Capture what was decided/produced, not process.
- base_truth_diff.add: New facts, constraints, preferences, or decisions established.
- base_truth_diff.update: Corrections or changes to previously known facts.
  Format as the complete replacement string, not a delta description.
- base_truth_diff.remove: Facts now known to be stale or superseded.
- If the exchange is short and incidental, all diff arrays may be empty.
- Be aggressive about capturing hard constraints (cannot, must, always, never).
- Preserve technical specifics: library names, versions, types, function signatures.

Return ONLY valid JSON. No preamble, no explanation.
```

---

## 5. Base Truth Management

The base truth array is the most critical structure to manage correctly. It is the chat model's long-term memory and the primary source of context fidelity.

### 5.1 Applying Diffs

Apply diffs in order: remove → update → add. This prevents conflicts where an update tries to modify a fact that should have been removed.

```js
function applyDiff(baseTruth, diff) {
  let bt = [...baseTruth];

  // 1. Remove stale facts
  if (diff.remove) {
    bt = bt.filter(f => !diff.remove.some(r => f.includes(r)));
  }

  // 2. Update existing facts (fuzzy match on key phrase)
  if (diff.update) {
    diff.update.forEach(updated => {
      const key = updated.split(':')[0];  // e.g. 'Python version'
      const idx = bt.findIndex(f => f.startsWith(key));
      if (idx !== -1) bt[idx] = updated;
      else bt.push(updated);  // fallback: treat as new
    });
  }

  // 3. Add new facts
  if (diff.add) bt.push(...diff.add);

  return bt;
}
```

### 5.2 Pruning Base Truth

Base truth can grow unboundedly in long conversations. Add a consolidation step every 15–20 turns: send the full base truth array to the summarizer and ask it to merge redundant entries, remove outdated inferences, and return a condensed version. This keeps token cost stable.

---

## 6. Short vs. Long Message Handling

Not every exchange warrants the same summarization depth. Use message length as a proxy for complexity:

| Message Size | Treatment |
|---|---|
| Short (< ~40 words each) | Summary only. Skip base truth diff extraction. Reduces summarizer cost and latency for casual exchanges. |
| Medium (40–200 words) | Summary + base truth diff. Standard path. |
| Long (200+ words) | Summary + base truth diff + flag for raw preservation. Consider keeping the assistant reply in the raw window for 1–2 extra turns before eviction. |
| Code-heavy exchanges | Always extract diff regardless of length. Code changes often introduce hard constraints (function signatures, types, patterns in use) that summaries alone cannot capture. |

---

## 7. Failure Handling

The summarizer is a second AI call that can fail, timeout, or return malformed output. A silent failure corrupts your memory log. Plan for all cases:

| Failure Mode | Mitigation |
|---|---|
| Malformed JSON | Catch parse errors. Retry once with the same payload. On second failure, store the raw exchange text as a fallback summary and skip diff. |
| Summarizer timeout | Set a hard timeout (e.g. 8s). On timeout, store raw text fallback. Flag the turn as unsummarized for a background retry. |
| Diff references unknown fact | If update targets a fact not found in base truth, treat it as add. Log a warning for monitoring. |
| Summarizer hallucination | Periodically log base truth snapshots. Add a lightweight validation layer checking that diff entries are plausible substrings of the raw exchange. |
| Race condition | Per-session mutex. Queue Phase 1 if Phase 2 from prior turn is still running. |

---

## 8. What This Architecture Does Not Solve

Being explicit about the remaining limitations is important for setting correct expectations and knowing when to augment the system.

> **Precise backward reference** — If a user says "go back to the version from turn 3", the raw window won't have it and the summary won't have the exact code. Solution: store outputs you expect users to reference (code blocks, drafts) in a separate keyed artifact store alongside the turn log.

> **Very long single messages** — A 2,000-word user message or a 3,000-token assistant reply cannot be faithfully compressed into 30 words without loss. For document-editing or long-form writing sessions, supplement with a diff of the document itself rather than relying on message summaries.

> **Summarizer bias** — The summarizer decides what matters. It will be biased toward the end of long exchanges and may under-weight early constraints. Mitigate with an explicit prompt instruction: "Pay special attention to constraints, exceptions, and requirements stated in the first 25% of the message."

---

## 9. What Separates This Design

The following features distinguish this architecture from naive summarization approaches and from common production patterns:

### 9.1 Independent Summarizer Model
Most implementations either send the full history (hitting context limits fast) or ask the chat model to compress its own output in the same pass. A dedicated summarizer with its own system prompt, running after the reply is delivered, is architecturally cleaner and produces higher-quality memory because it has single-purpose focus and the complete exchange in context.

### 9.2 Diff-Based Base Truth Mutation
Rather than rewriting base truth wholesale each turn (expensive, risky) or just appending facts (leads to contradictions), you apply a structured diff: add, update, remove. This gives you conflict resolution at the memory layer rather than leaving contradictions for the chat model to sort out at inference time. Most production memory systems either don't do this or do it far less precisely.

### 9.3 Size-Adaptive Summarization Depth
Short exchanges get lightweight treatment; long, complex exchanges trigger full diff extraction. This keeps cost and latency proportional to the actual complexity of the turn, rather than running maximum-depth summarization on every message regardless of content.

### 9.4 Two-Speed Context
The chat model receives both the compressed long-term memory (base truth + turn log) and a verbatim short-term window. This means precise recent references work perfectly while distant context degrades gracefully to summaries — matching how the actual failure modes of pure-summary systems manifest in practice.

---

## 10. Implementation Checklist

- [ ] **Session store** — `baseTruth[]`, `turnLog[]`, `rawWindow[]` per session ID
- [ ] **Chat endpoint** — Inject base truth + turn log into system prompt; append raw window to messages
- [ ] **Summarizer call** — Fire after chat reply is returned; separate API key/model config
- [ ] **Diff application** — remove → update → add order; fuzzy key matching for updates
- [ ] **Size routing** — Short / medium / long / code-heavy thresholds with appropriate depth
- [ ] **Failure handling** — JSON parse retry, timeout fallback, race condition mutex
- [ ] **Base truth pruning** — Consolidation call every 15–20 turns
- [ ] **Raw window eviction** — Configurable N (start with 6); evict oldest on overflow
- [ ] **Monitoring** — Log base truth snapshots periodically; flag unsummarized turns
- [ ] **Artifact store (future)** — Key-value store for code blocks and drafts that users may reference by turn

---

## 11. Thought Process & Idea Provenance

This section documents how the architecture evolved across the design conversation — which ideas originated with the designer, and where the AI collaborator pushed back, extended, or filled in mechanics. This is an honest record, not a flattering one.

### Ideas Originated by the Designer

**Idea 1 — Dual-format API response**
The opening proposal: ask the model to return both the user-facing reply and a JSON memory blob in a single response. Established the core premise that memory should be generated inline rather than inferred separately after the fact.

**Idea 2 — Separate summarizer model** *(most architecturally significant)*
Rather than accepting the limitation of self-summarization, the designer proposed triggering an entirely separate API call using a different, more capable model purely for summarization. This was unprompted and is the decision that makes the rest of the architecture viable.

**Idea 3 — Better model for summarization, standard for chat**
A deliberate and counter-intuitive inversion: spend more capability on memory management than on the chat response itself. The reasoning: the summarizer's judgment about what matters compounds across every future turn, making it the higher-leverage inference call.

**Idea 4 — Base truth as a separate living layer**
The designer identified that summaries of exchanges are not the same as established facts, and proposed maintaining them separately. This is the conceptual leap that separates this design from naive summarization — facts as first-class citizens that persist and override turn-log ambiguity.

**Idea 5 — Size-adaptive summarization depth**
Short messages get lightweight summaries only; longer, complex exchanges trigger full base truth extraction. The designer's recognition that not all turns carry the same memory weight — a cost/quality optimization that most production systems don't make this explicitly.

**Idea 6 — Hard exceptions as a named category**
Explicitly naming hard exceptions (things the system must never do) as distinct from general facts. Exceptions require different handling — they should never be pruned and should be surfaced prominently in the chat model's context.

---

### Contributions from the AI

**The diff structure (add / update / remove)**
The designer described the goal — a base truth that mutates rather than just accumulates. The AI proposed the concrete mechanism: a structured diff with three explicit operations (add, update, remove) applied in a fixed order. This was the primary mechanical contribution.

**The raw message window as a complement**
The designer never mentioned keeping recent raw messages alongside the compressed memory. The AI added this to address a gap: without it, users asking about the last thing said would get summary-degraded answers rather than precise ones.

**Failure mode identification & stress-testing**
After each idea, the AI named failure modes: cascading summary degradation, hallucination, diff application conflicts, race conditions, base truth bloat, and the ceiling cases where even this architecture fails. None were raised by the designer — this was adversarial review, not ideation.

---

### Verdict

| Designer Originated | AI Contributed |
|---|---|
| Dual-format response | Diff format (add / update / remove) |
| Independent summarizer model | Raw message window complement |
| Better model for memory vs. chat | Failure mode identification & stress-testing |
| Base truth as a living document | |
| Size-adaptive summarization depth | |
| Hard exceptions as named category | |

**The architectural shape — independent summarizer, two-layer memory, base truth as a living document, size-adaptive depth — is the designer's. The AI stress-tested each step and filled in implementation mechanics. The diff structure was the AI's primary concrete contribution. The rest was the designer reasoning through a problem iteratively and getting it right.**

---

> **The honest ceiling** — This architecture handles the vast majority of task-focused conversations with strong context fidelity. It will strain under highly referential conversations where users point back to exact earlier phrasing, or in document-editing sessions where the artifact itself is the ground truth. For those cases, the artifact store and document-diff extensions noted above are the right next investments — not rebuilding the memory layer.

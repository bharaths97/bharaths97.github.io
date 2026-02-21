# Memory System — Checkpoint Base Truth Prompt

You already know this codebase. I need you to help me implement a lightweight memory layer for our LLM chat. Here is the idea:

---

## What We're Building

Two in-memory structures per session:

```js
session = {
  baseTruth: [],   // living facts — mutated, never just appended
  turnLog: [],     // compressed summary of each exchange, append-only
  rawWindow: [],   // last 6 raw messages verbatim
}
```

After every chat turn, a **separate summarizer model** (smarter, dedicated) reads the raw exchange and returns:

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

Diff is applied `remove → update → add`. Base truth is injected at the top of the chat model's system prompt every turn, alongside a condensed turn log. Raw window sits in the message history as-is.

Short exchanges (< ~40 words each): summary only, skip diff. Long or code-heavy exchanges: full diff extraction.

---

## What I Need From You Now

Before writing any code, give me a **checkpoint base truth** about this codebase — what you know that is directly relevant to implementing this:

- What is our current chat/message pipeline and where does it live?
- How are sessions managed today?
- Which LLM client/SDK are we using and where are API calls made?
- Is there anywhere we already pass a system prompt, and what's in it?
- Any existing memory, context, or history handling I should know about?
- What's the right place to insert the summarizer call without blocking the user response?

Be direct. Facts only. This output will itself become the first base truth for building this feature.

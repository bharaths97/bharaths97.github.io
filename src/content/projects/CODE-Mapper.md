---
title: Can AI Reason About Security? I Built Something to Find Out.
summary: A commercial tool found one vulnerability. Mine found three — and mapped the attack chain.
tags: Agentic AI, SAST Tooling, Code Review
order: 1
---

I didn't build this because I think AI is magic. I built it because I wanted to understand exactly where AI reasoning adds something real to security analysis, and where it doesn't. The answer turned out to be more interesting than I expected.

---

## The Question

Security tooling is full of pattern matchers. Semgrep, CodeQL, Snyk — they trace known dangerous functions back to taint sources. They're fast, consistent, and good at finding what they were trained to find.

The gap is semantic understanding. A pattern matcher sees `unlink(user_input)` and flags it. It doesn't ask: *what can a caller actually do with this?* It doesn't reason about whether that dangerous call is the symptom or the disease.

LLMs do reason about intent. That's what I wanted to test.

---

## What I Built

**[CODE_MAPPER](https://github.com/bharaths97/Agents/tree/main/CODE_MAPPER)** is a multi-agent pipeline that performs security analysis on codebases. Not a single prompt — a staged pipeline where five specialised agents build on each other's output before anything is flagged as a vulnerability.

Here's the flow:

```
Agent 1a  →  What does this codebase do? What's the domain?
Agent 1b  →  What does each file do? Where are the dangerous patterns?
Agent 1c  →  What data flows through here? What's sensitive?
Agent 1d  →  Per file: what are the sources? What are the sinks? What lines?
Agent 1e  →  Trace source → sink. Is this exploitable? How?
```

Agent 1d is the pivot. It produces a structured [terrain object](https://github.com/bharaths97/Agents/tree/main/CODE_MAPPER/Documentation/architecture.md#agent-1d--terrain-synthesizer) for each file — a map of where untrusted data enters (sources) and where dangerous operations happen (sinks), with exact line numbers. Agent 1e uses those anchors to do focused taint tracing, reading only the code around the relevant lines rather than the whole file.

After Agent 1e, an [adversarial verifier](https://github.com/bharaths97/Agents/tree/main/CODE_MAPPER/Documentation/architecture.md#adversarial-verifier) challenges every high-severity finding with a separate LLM call — essentially asking: *is there a reason this is a false positive?* If the finding can't survive that challenge, confidence drops or severity is downgraded.

---

## The Benchmark: One File, Two Tools

I ran both CODE_MAPPER and Snyk against the same C file — `fileio.c` from [go-sqlite3-ext](https://github.com/MoshZillaRadio/go-sqlite3-ext), a public repository hosted by [CodeWhite](https://github.com/MoshZillaRadio) as part of a CTF challenge. Real production-weight C code, not a toy example.

**Snyk found one finding.**

![Snyk finding panel — path traversal (CWE-23)](/images/projects/code-mapper/snyk-finding-panel.png)

Path traversal. `unlink(zFile)` called with an unsanitised user-supplied path. CWE-23. Fair enough — it's a real vulnerability.

**CODE_MAPPER found three findings**, which together form a complete attack chain:

The results can be [found here](https://github.com/bharaths97/Agents/blob/main/CODE_MAPPER/Documentation/Test_Report_1.html)

| Stage | Finding | What it means |
|---|---|---|
| Reconnaissance | `fsdir` virtual table | `SELECT name, data FROM fsdir('/etc')` — enumerate and read an entire directory tree in one SQL query |
| Exfiltration | `readfile()` | `SELECT readfile('/root/.ssh/id_rsa')` — arbitrary file read, returned as a SQL BLOB |
| Persistence / RCE | `writefile()` | Write arbitrary content to any path — cron jobs, authorised keys, web shells |

Snyk found the tail of Stage 3. A developer patching Snyk's finding — removing or guarding the `unlink()` call — would leave Stages 1 and 2 fully intact, and the rest of Stage 3 exploitable through `fopen`/`fwrite` alone.

The root cause CODE_MAPPER identified: **no `realpath()` call, no allowlist check, at any of the three entry points**. One fix closes everything. Snyk's remediation closes one sink. See the [full technical breakdown](https://github.com/bharaths97/Agents/tree/main/CODE_MAPPER/Documentation/snyk-comparison.md) for the complete taint path comparison.

---

## Where the Reasoning Actually Helps

The difference isn't raw detection. It's *what kind of reasoning* happens before flagging.

Snyk works backward: dangerous function → trace to source. It finds the call.

CODE_MAPPER works forward: understand the code's intent, map the entry points, then trace outward. That's why it found `fsdir` — a virtual table, not a function call, with no dangerous function in its definition. There's nothing for a backward trace to start from. You have to understand what a virtual table column accessor does before you can see it as a data exfiltration path.

That's genuine semantic understanding producing a real security result.

---

## Where Reasoning Isn't Enough

The most instructive failure came from the same codebase.

The [go-sqlite3-ext](https://github.com/MoshZillaRadio/go-sqlite3-ext) repo is a CodeWhite CTF challenge — meaning alongside the real vulnerabilities, there's a hidden flag deliberately planted in the code for participants to find. The same tool that mapped a three-stage attack chain across `fileio.c` missed the flag entirely.

It was split across two C comment lines, with a Windows API constant name (`FILE_FLAG_BACKUP_SEMANTICS`) immediately before `FLAG{` on the same line, and the closing `}` on the line below. The flag was well within the context window. Every model I tested received the full file. None caught it.

Why? The detection prompt looks for `FLAG{` patterns. With the API constant name preceding it and the brace split across lines, the pattern was camouflaged — not by encryption, not by encoding, just by visual noise and a line break. The model reasoned correctly about everything around it. It just didn't see that specific anomaly.

The same run: found three real vulnerabilities a commercial tool missed, failed to spot four words in a comment.

That contrast is the whole point. Reasoning only applies to what you specifically ask the model to reason about. Outside that scope, it's as blind as any other tool — and in some ways more brittle, because you assume it's looking when it isn't.

---

## The Model Quality Problem

The most surprising result came from running the same pipeline with a different model.

I ran CODE_MAPPER against the go-sqlite3-ext repo twice — once with a stronger reasoning model, once with a cheaper one. The stronger model found the three findings above. The cheaper model found none from that file.

The cheaper model didn't fail at taint tracing. It failed at **terrain synthesis** — Agent 1d's job of identifying sources and sinks with accurate line numbers. Without good line numbers, Agent 1e skips the file entirely. One weak link in the chain, and the whole run produces nothing.

This matters architecturally. If you're building a multi-agent pipeline, the weakest reasoning step determines the output quality of everything after it. Choosing models by stage — cheaper for classification tasks, capable for reasoning tasks — is the right call. Using the cheapest model everywhere breaks the chain silently.

---

## What This Project Is and Isn't

This is a research project, not a production tool. It's slower than traditional SAST, and it doesn't replace Semgrep for the things Semgrep is good at.

But it found a complete attack chain that a commercial tool missed. It identified root causes rather than symptoms. And it surfaced reasoning about *why* a path is dangerous, not just *that* it is.

That gap — between flagging a dangerous call and understanding an attack — is where I think AI has something genuine to add to security workflows. Not as a replacement for existing tooling. As the reasoning layer on top of it.

I'm still running comparisons. More to come.

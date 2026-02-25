---
title: Can AI Reason About Security? I Built Something to Find Out.
summary: A commercial tool found one vulnerability. Mine found three — and mapped the attack chain.
tags: Agentic AI, SAST Tooling, Code Review
order: 1
---

I didn’t build this because I think AI is magic. I built it because I wanted to stress-test a very specific question:
**Can an LLM actually reason about security — or is it just doing expensive pattern matching?**
The answer ended up being more nuanced (and more interesting) than I expected.
---

## The Question
Most security tooling today is pattern-driven. Semgrep, CodeQL, Snyk — they work backwards from known dangerous functions to potential taint sources. They’re fast. They’re deterministic. They’re very good at catching what they were designed to catch. But they don’t understand intent.

If a pattern matcher sees `unlink(user_input)`, it flags it. It doesn’t ask: *what is this code trying to enable?*  
It doesn’t ask whether the dangerous call is the root cause — or just one symptom. LLMs, in theory, can reason about intent. That’s what I wanted to test.

---

## What I Built

[CODE_MAPPER](https://github.com/bharaths97/Agents/tree/main/CODE_MAPPER) is a staged, multi-agent security analysis pipeline.

Not a single giant prompt. Not “scan this file and tell me what’s wrong.”  
It’s a layered workflow where five specialized agents build structured context before anything is marked as a vulnerability.

The flow looks like this:
```
Agent 1a  →  What does this codebase do? What's the domain?
Agent 1b  →  What does each file do? Where are the dangerous patterns?
Agent 1c  →  What data flows through here? What's sensitive?
Agent 1d  →  Per file: what are the sources? What are the sinks? What lines?
Agent 1e  →  Trace source → sink. Is this exploitable? How?
```
Agent 1d is the pivot.
It generates a structured [terrain object](https://github.com/bharaths97/Agents/blob/main/CODE_MAPPER/Documentation/architecture.md#agent-1d--terrain-synthesizer) per file — a map of:

- where untrusted input enters (sources)
- where dangerous operations occur (sinks)
- the exact line numbers for both

Agent 1e then does focused taint tracing, but only around those anchors. It doesn’t reread the entire file blindly. It reasons locally, with structure.

After that, an [adversarial verifier](https://github.com/bharaths97/Agents/blob/main/CODE_MAPPER/Documentation/architecture.md#adversarial-verifier) challenges every high-severity finding in a separate LLM call:

> “Is there a reason this could be a false positive?”

If the finding can’t survive that pushback, confidence drops or severity gets downgraded. This was intentional. I didn’t want hype. I wanted friction because that's what we do during a manual code review.

---

## The Benchmark: One File, Two Tools

I ran both CODE_MAPPER and Snyk against the same C file — `fileio.c` from [go-sqlite3-ext](https://github.com/MoshZillaRadio/go-sqlite3-ext), a public repository hosted by [CodeWhite](https://github.com/MoshZillaRadio) as part of a CTF challenge.

**Snyk found one finding.**
Path traversal via `unlink(zFile)`. CWE-23.

![Snyk finding panel — path traversal (CWE-23)](/images/projects/code-mapper/snyk-finding-panel.png)


**CODE_MAPPER found three findings**, which together form a full attack chain.

Full results here:
https://github.com/bharaths97/Agents/blob/main/CODE_MAPPER/Documentation/Test_Report_1.md

| Stage | Finding | What it means |
|---|---|---|
| Reconnaissance | `fsdir` virtual table | `SELECT name, data FROM fsdir('/etc')` — enumerate and read a directory tree in one SQL query |
| Exfiltration | `readfile()` | `SELECT readfile('/root/.ssh/id_rsa')` — arbitrary file read returned as a SQL BLOB |
| Persistence / RCE | `writefile()` | Write arbitrary content anywhere — cron jobs, authorized keys, web shells |

Snyk flagged the tail end of Stage 3. If a developer “fixes” the Snyk finding by guarding or removing `unlink()`, Stages 1 and 2 remain fully exploitable — and Stage 3 is still reachable via `fopen`/`fwrite`.

The root cause CODE_MAPPER identified:
> No `realpath()` resolution.  
> No allowlist enforcement.  
> At any of the three entry points.

One architectural fix closes everything. Snyk’s remediation closes one sink.

Full technical comparison:
https://github.com/bharaths97/Agents/blob/main/CODE_MAPPER/Documentation/snyk-comparison.md

---

## Where the Reasoning Actually Helps

The real difference wasn’t detection volume. It was direction of reasoning.

Snyk works backward:
> dangerous function → trace to source

CODE_MAPPER works forward:
> understand intent → map entry points → trace outward

That’s why it found `fsdir`. `fsdir` is a virtual table. There’s no obvious “dangerous function” sitting there. No classic sink to anchor a backward trace. You have to understand what a virtual table accessor enables before you see it as a data exfiltration path. That’s semantic reasoning producing a real security outcome.

---

## Where Reasoning Breaks

The most humbling failure came from the same repo. The [go-sqlite3-ext](https://github.com/MoshZillaRadio/go-sqlite3-ext) challenge includes a hidden CTF flag deliberately planted in the code. The same pipeline that mapped a three-stage exploit chain missed the flag entirely.

It was split across two C comment lines.  
A Windows API constant (`FILE_FLAG_BACKUP_SEMANTICS`) appeared right before `FLAG{` on the same line.  
The closing `}` was on the next line. The flag was fully inside the context window. Every model received the entire file. None caught it. Why?
Because the detection prompt looked for `FLAG{`. The constant name plus line break visually camouflaged the pattern. No encryption. No encoding. Just noise and formatting.

Same run:
- Found three real vulnerabilities a commercial tool missed.
- Failed to detect four words in a comment.

That contrast matters. LLM reasoning only applies to what you explicitly frame as a reasoning task. Outside that scope, it’s blind — and sometimes more brittle than deterministic tooling.

---

## The Model Quality Problem

The most surprising result wasn’t vulnerability detection. It was model variance.
I ran the exact same pipeline twice:
- Once with a stronger reasoning model.
- Once with a cheaper one.

Stronger model → three findings.  
Cheaper model → zero findings from that file.

The failure wasn’t in taint tracing. It failed in **terrain synthesis** (Agent 1d). If line numbers for sources and sinks are wrong, Agent 1e skips the file entirely. One weak reasoning stage breaks the whole pipeline. Architecturally, this matters.

In a multi-agent system:
> The weakest reasoning step determines downstream output quality.
Using cheaper models for classification steps makes sense. Using cheaper models for structural reasoning silently collapses the chain.

---

## What This Is (And Isn’t)

This is not a production SAST replacement. It’s slower than Semgrep. It doesn’t compete with CodeQL on rule coverage.

But it did:
- Identify a complete attack chain a commercial tool missed.
- Isolate root cause instead of surface-level symptoms.
- Explain *why* a path is dangerous — not just that it matches a pattern.

That’s the gap I care about. Not replacing existing tooling. Layering reasoning on top of it. Still running comparisons. More to come.
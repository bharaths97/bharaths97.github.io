---
title: ManageEngine VMP Disclosures
summary: Responsible disclosure notes for endpoint-agent issues that were acknowledged and patched.
tags: vulnerability-research, disclosure, windows
order: 2
---

## Context
This work focused on endpoint-agent behavior in production environments where high privilege and operational reliability are both critical.

## Findings
- Sensitive logs included information that should not have been written in failure paths.
- Agent execution path handling enabled a privilege-escalation opportunity via path hijacking behavior.
- The exploitability analysis depended on install context and service execution assumptions.

## Impact
Both issues were suitable for responsible disclosure because they affected trust boundaries in enterprise security tooling.

## Remediation and Validation
1. Shared reproducible steps and technical details with vendor security contacts.
2. Worked through triage questions and impact clarifications.
3. Verified fixes after vendor patch release.

## References
- [Sensitive Information Logging Advisory](https://www.manageengine.com/vulnerability-management/sensitive_info_logging_fix.html)
- [Path Hijacking Security Update](https://www.manageengine.com/vulnerability-management/path_hijacking_security_update_2024.html)

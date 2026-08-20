---
type: Reference
title: Released OAS 0.20.0 doctor falsely reports every v2-locked capability as an orphan
description: A framework-side diagnostic false positive — doctor checks materialized capabilities against the legacy v1 lock map, which is always empty under lockfileVersion 2.
tags: [oas-cli, doctor, lockfile, known-defect, oas-0.20]
timestamp: 2026-08-20
---

# Symptom

With a correct, complete lockfileVersion 2 lock, `oas doctor` prints for every
materialized capability:

```
WARNING: <id> at <scope>/.agents/capabilities/installed/<id> is in installed/
but has no lock entry — reacquire it or move it to owned/
```

Reacquiring changes nothing. The lock genuinely contains the capability row.

# Cause

`bin/oas.mjs` tests `!locks[id]` where `locks = readCapabilityLocks(ctx)`.
`readCapabilityLocks` (`lib/core.mjs`) deliberately returns **only
lockfileVersion 1 legacy capability rows** — its own comment says a converted
scope has none and its capabilities "are served by the capability rows
instead". So under a v2 lock the map is always empty and the guard always
fires. Verified in released `@oas-framework/oas@0.20.0`.

# Posture

Cosmetic: acquisition, materialization, restore, activation, trust and spawn
are all unaffected. It belongs to the framework, not to any package.

**Do not carry a package-side workaround for it.** Masking a kernel bug behind
a package quirk hides the defect and leaves the package owning a permanent
oddity. Report it upstream, preserve the exact warning text as probe evidence,
and assert the lock's real shape in tests instead.

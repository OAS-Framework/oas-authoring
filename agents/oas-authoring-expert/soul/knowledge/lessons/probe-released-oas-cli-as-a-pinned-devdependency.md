---
type: Lesson
title: Probe OAS packages against the released CLI pinned as a devDependency
description: Consumer probes must drive the exact released OAS CLI they claim compatibility with and assert end effects in throwaway scopes.
tags: [testing, consumer-probe, oas-cli, ci, packaging]
timestamp: 2026-08-20
---

# The durable lesson

Package claims are only meaningful when they are checked against the released
kernel version consumers will run. A probe that uses `npx`, the developer's
global CLI, or a checked-out framework head can pass while saying nothing about
the package's published compatibility.

The repeatable procedure lives in the `oas-package-consumer-probes` soul skill.
Use this concept for the principles that should survive across individual probe
implementations.

# Rules that made the probes worth having

- **Pin the exact released kernel** as a devDependency, and assert that version
  inside the suite.
- **Drive the real binary, in a temp scope.** `mkdtemp` + `git init` per test,
  removed in `t.after`. Scrub `PI_AGENTS_ROOT` / `OAS_INSTANCE*` from the child
  env so a probe can never read the developer's real deployment.
- **Assert on what the kernel WROTE**, not on exit codes and log lines: the
  materialized tree, the lock JSON's exact shape, the ignore file, the adopted
  base, the composed instance's skill bytes.
- **Assert the end effect, not the last step you performed.** The activation
  bug in [the agent-types mapping lesson](/lessons/oas-config-agent-types-must-be-a-mapping.md) passes every check up to
  and including "adoption succeeded". Only "does a freshly spawned instance
  have the skill file, byte-identical to the materialized artifact" catches it.
- **Assert absences too.** `oas-package.json` and `config-templates/` must NOT
  appear in the materialized artifact; legacy `capabilities`/`trustedCapabilities`/
  `depsIntegrity` keys must NOT appear in a v2 package row.
- **Diff vendored schemas against the released package's own copies.** Turns
  "these were verified against a reviewed head" into a standing CI assertion.
- **Verify the probe can fail.** Reintroduce the defect, watch the specific
  tests go red, restore. A green probe never observed failing is decoration.
- **Skip cleanly, never silently.** Skip with a reason when the CLI is absent;
  in CI install it and let the step fail if it is not there.

# Gotcha

Reading a published payload out of git history (`git archive <tag>`) needs
`fetch-depth: 0` in `actions/checkout`, or the probe silently skips in CI.

# Schema status

- **Vendored schemas verified against the RELEASED kernel.** All four schemas
  in `schemas/` — `oas-package.schema.json`, `capability-manifest.schema.json`,
  `oas-lock.schema.json`, `oas-config.schema.json` — are byte-identical to the
  canonical references shipped by released `@oas-framework/oas@0.20.0`
  (`docs/*.schema.json`). This is no longer a claim about a reviewed head: it is
  asserted on every CI run by `test/consumer-probe.test.mjs`, which diffs each
  vendored file against the pinned released package's copy and fails on drift.
- **Dedicated capability root.** `oas-package.json` exports
  `capabilities/oas-authoring`, not `.`. A `"."` root is read compatibility for
  already-published packages (`oas.authoring@1.0.0` is `capabilities: ["."]`)
  and the validator now rejects it for newly authored packages.
- **Consumer fixture gate: CLOSED.** The former
  `TODO(engine-consumer-fixtures)` item is discharged.
  `test/consumer-probe.test.mjs` drives the real released CLI — resolved from
  the pinned `@oas-framework/oas` devDependency, never the machine's global
  install — through acquire → lock → restore → adopt → activate → spawn against
  throwaway scopes, and asserts flat materialization, the two-level lock shape,
  the installed-store ignore, exact restore, the recorded adopted base, and
  byte-identical skill composition into fresh instances of both declared agent
  types. This package has no executable surface and requires no `oas trust`;
  the probes assert `trusted: false` in the lock rather than approving anything.
- **v1.0.0 stays consumable.** A probe installs the payload read straight out
  of the `v1.0.0` tag with the same released kernel and asserts it still
  acquires and materializes. Its lock records `path: "."`, and the artifact
  visibly contains `oas-package.json` — package-only material dragged in
  because the package root *was* the capability root. That contrast is the
  reason v2.0.0 moved to a dedicated root, and both sides of it are asserted.

## Known released-kernel defect (not worked around here)

Released 0.20.0 `oas doctor` prints

```
WARNING: oas.authoring at <scope>/.agents/capabilities/installed/oas.authoring is in installed/ but has no lock entry — reacquire it or move it to owned/
```

for **every** capability materialized under a lockfileVersion 2 lock.
`readCapabilityLocks` (`lib/core.mjs:833`) returns only legacy
lockfileVersion 1 rows, while `bin/oas.mjs:425` tests `!locks[id]` against that
map — so a correct v2 capability row can never satisfy it. Our lock is correct
and complete (`test/consumer-probe.test.mjs` asserts its exact shape).

This is a framework-side diagnostic false positive, escalated to the framework
owner. **No workaround is carried in this package**, deliberately: masking it
here would hide a kernel bug behind a package quirk. The warning is preserved
verbatim as probe evidence.

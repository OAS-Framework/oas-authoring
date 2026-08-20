---
name: oas-package-consumer-probes
description: >-
  Use when adding or reviewing OAS package compatibility tests, consumer probes,
  capability materialization checks, config-template adoption checks, lockfile
  assertions, or release gates that must drive a published @oas-framework/oas
  CLI instead of the developer's checkout or global binary.
---

# OAS package consumer probes

Write probes that behave like a consumer installing the package with the exact
released OAS CLI the package claims to support. Do not simulate kernel behavior
or run against an ambient global CLI.

## Procedure

1. **Pin the kernel under test.** Add the exact released CLI as a devDependency,
   for example:

   ```json
   "devDependencies": { "@oas-framework/oas": "0.20.0" }
   ```

2. **Resolve the binary from `node_modules`.** Do not use `npx` and do not rely
   on whatever `oas` is on the machine PATH.

   ```js
   const CLI_PACKAGE = dirname(require.resolve("@oas-framework/oas/package.json"));
   const CLI = join(CLI_PACKAGE, "bin", "oas.mjs");
   ```

3. **Assert the CLI version inside the suite.** A probe that runs against an
   unknown kernel version reports a pass that means nothing.

4. **Use a fresh throwaway scope for each test.** Create it with `mkdtemp`, run
   `git init`, and remove it in `t.after`.

5. **Scrub agent/deployment environment from child processes.** Remove
   `PI_AGENTS_ROOT` and `OAS_INSTANCE*` entries so the probe cannot see the
   developer's real OAS deployment.

6. **Drive the real CLI end-to-end.** Install/adopt/spawn through the binary and
   assert on what it writes: materialized tree contents, lock JSON shape,
   ignored paths, adopted config base, and composed instance skill bytes.

7. **Assert the end effect, not just the command that should have caused it.**
   For capability targeting, spawn a fresh instance and verify the skill file is
   present and byte-identical to the materialized artifact.

8. **Assert absences too.** Package-only files such as `oas-package.json` and
   `config-templates/` must not appear inside the materialized capability
   artifact; legacy v1 lock keys must not appear in a v2 package row.

9. **Diff vendored schemas against the released package's own copies** so
   reviewed-head verification becomes a standing CI assertion.

10. **Prove the probe can fail.** Reintroduce the defect, watch the specific
    tests go red, then restore. A green probe never observed failing is
    decoration.

11. **Skip only with an explicit reason.** Locally, skip cleanly when the CLI is
    absent. In CI, install it and let the step fail if it is not there.

## Gotchas

- `node --test` with no file arguments recurses through OAS instance work trees.
  Test scripts in OAS repositories must name the files they intend to run.
- `git archive <tag>` from checkout history needs `fetch-depth: 0` in
  `actions/checkout`, or a CI probe can silently skip because the tag object is
  unavailable.
- Do not interpolate temp paths into `sh -c`; `TMPDIR` is environment input.
  Use argv arrays and pipe data through Node instead of a shell pipeline.

## Related knowledge

See `knowledge/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md` for
why these probes matter, plus the linked lessons for the silent activation and
shell-injection failures that made the rule durable.

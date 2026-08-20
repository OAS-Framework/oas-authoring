---
type: Lesson
title: Never use bare `node --test` in an OAS repository
description: Unbounded test discovery recurses into agents/<soul>/instances/<id>/work trees and runs stale sibling suites, making the package gate's result depend on which agents happen to be alive.
tags: [testing, node-test-runner, oas, ci, reproducibility]
timestamp: 2026-08-20
---

# The problem

`node --test` with no path arguments discovers test files recursively from the
working directory. An OAS repository is not a flat project: live agents grow
`agents/<soul>/instances/<id>/work` trees inside the checkout, and attached or
worktree modes put whole other branches' test suites under them.

So `"test": "npm run validate && node --test"` means the package's gate result
depends on which agent instances happen to exist at that moment. Demonstrated
directly: planting one test file under
`agents/oas-authoring-expert/instances/demo/work/test/` changed the suite from
33 tests to 35, and the planted one ran and failed. The explicit scripts were
unaffected.

# The fix

Name the files. Compose the gate from explicit scripts:

```json
"test:unit":  "node --test test/a.test.mjs test/b.test.mjs",
"test:probe": "node --test test/consumer-probe.test.mjs",
"test":       "npm run validate && npm run test:unit && npm run test:probe"
```

Then assert it in the suite itself — `npm test` must not match
`node --test` with no file argument — so the convenience of bare discovery
cannot creep back in later.

# Why it is worth a rule rather than a preference

The failure is not "a test fails". It is that the gate silently measures
something other than the package, and does so intermittently, depending on
unrelated agent lifecycle. A gate whose meaning depends on ambient state is
worse than no gate, because it is still believed.

Related: [released CLI probes](/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md).

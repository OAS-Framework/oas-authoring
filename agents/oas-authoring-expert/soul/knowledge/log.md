# Knowledge Log

## 2026-08-20
* **Creation**: [An agent's authorization to act does not dissolve the author's own role boundary](/decisions/authorization-does-not-override-role-boundaries.md) - promoted delivery-boundary decision from v2 release notes.
* **Creation**: [An authored OAS package must export a dedicated capability root, never "."](/decisions/oas-package-dedicated-capability-root.md) - promoted capability-materialization decision from v2 release notes.
* **Creation**: [Never use bare `node --test` in an OAS repository](/lessons/bare-node-test-discovery-in-oas-repos.md) - promoted OAS repository test-discovery lesson from v2 release notes.
* **Creation**: [Lexical path prefix checks are not containment checks](/lessons/lexical-path-checks-are-not-containment-checks.md) - promoted containment and escaping validation lesson from v2 release notes.
* **Creation**: [agent-types targeting must be a YAML mapping — a block list silently activates nothing](/lessons/oas-config-agent-types-must-be-a-mapping.md) - promoted config-targeting lesson from v2 release notes.
* **Creation**: [oas okf harvest cannot spawn from an attached-mode instance](/lessons/oas-okf-harvest-fails-from-attached-instances.md) - promoted attached-mode harvest lesson from v2 release notes.
* **Creation**: [A one-shot reviewer that retires before mailing loses its verdict with no trace](/lessons/one-shot-reviewers-can-lose-verdicts-silently.md) - promoted reviewer-retirement coordination lesson from v2 release notes.
* **Creation**: [Probe OAS packages against the released CLI pinned as a devDependency](/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md) - promoted consumer-probe lesson from v2 release notes.
* **Creation**: [Never interpolate a temp path into a shell command — TMPDIR is attacker-controlled input](/lessons/shell-interpolation-of-tmpdir-in-tests.md) - promoted shell-injection testing lesson from v2 release notes.
* **Creation**: [Never verify an escaping-sensitive finding through an inline shell command](/lessons/verify-escaping-sensitive-findings-from-a-file.md) - promoted escaping-sensitive verification lesson from v2 release notes.
* **Creation**: [Released OAS 0.20.0 doctor falsely reports every v2-locked capability as an orphan](/references/oas-doctor-false-orphan-warning-on-v2-locks.md) - promoted known framework diagnostic false positive from v2 release notes.
* **Fix**: [Triage a vanished one-shot agent by its mail, not its runtime — gone does not mean it never delivered](/lessons/one-shot-reviewers-can-lose-verdicts-silently.md) - retitled and reframed from "A one-shot reviewer that retires before mailing loses its verdict with no trace". The original taught that a missing roster row, home and tmux window meant the verdict was lost; that evidence proves only that the runtime ended. `reviewer-3ff0025` mailed APPROVE and then retired, leaving the identical shape, so the concept now requires a sender-position check of full mail history (with its body-text and prefix-overlap false-positive hazards) before classifying, and branches on that evidence instead.
* **Update**: skills/oas-package-consumer-probes - added a repeatable skill for released-CLI OAS package consumer probes, split from the v2 release probe playbook note.

## 2026-07-28
* **Initialization**: knowledge bundle scaffolded by oas-okf.

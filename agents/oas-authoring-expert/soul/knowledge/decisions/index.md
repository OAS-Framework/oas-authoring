# Decisions

* [An agent's authorization to act does not dissolve the author's own role boundary](authorization-does-not-override-role-boundaries.md) - When a coordinating agent instructed me to merge, tag and publish my own PR, the right move was to decline explicitly and route it to the owning actor — three agents agreeing is not the human approval an irreversible publish requires.
* [An authored OAS package must export a dedicated capability root, never "."](oas-package-dedicated-capability-root.md) - Why oas.authoring@2.0.0 moved its payload from capabilities:["."] to capabilities/oas-authoring, and what materialization does differently as a result.

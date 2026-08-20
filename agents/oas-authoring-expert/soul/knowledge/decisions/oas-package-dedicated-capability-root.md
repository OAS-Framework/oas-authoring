---
type: Decision
title: An authored OAS package must export a dedicated capability root, never "."
description: Why oas.authoring@2.0.0 moved its payload from capabilities:["."] to capabilities/oas-authoring, and what materialization does differently as a result.
tags: [oas-package, capability-materialization, packaging, containment, oas-0.20]
timestamp: 2026-08-20
---

# The model (released OAS 0.20.0)

The **package is transport**; the **capability is the installed entity**.
`oas install` stages the package in a temp transaction, validates the payload,
materializes each declared capability root **flat** into
`.agents/capabilities/installed/<id>/`, writes the exact lock, and discards
staging. There is no persistent package store. The lock has two levels:
`packages` (where the bytes came from) and `capabilities` (the materialized
artifact, its provider package, its dedicated path inside that package, its
artifact integrity, and its executable trust).

# The decision

`oas.authoring@2.0.0` declares `capabilities: ["capabilities/oas-authoring"]`.
`"."` is read compatibility for already-published packages only — the 0.20
reader accepts it when the manifest carries no `configTemplates`, and rejects
it as soon as it does.

# What this actually changes — measured, not argued

Installing the published `v1.0.0` payload (`capabilities: ["."]`) with released
0.20.0 materializes an artifact that **contains `oas-package.json`**: with the
package root as the capability root, package-only material is dragged into the
installed entity. The v2.0.0 payload materializes only `oas.json`, `skills/`,
`LICENSE`, and the generated `.oas-installation.json` — the package manifest
and the config template stay behind.

That is the whole point: only a dedicated, self-contained root is
independently hashable and independently trustable.

# The rule that follows for authoring

Everything a capability declares must resolve inside **its own** root, not
merely inside the package. A skill path reaching a sibling package directory
resolves fine during development and vanishes after materialization. So the
validator's containment boundary for capability resources is the capability
root; the package root is the boundary only for package-level resources.

# Config templates are source material

`configTemplates` (canonical 0.20 spelling; `configs` is the frozen 0.19 one,
and carrying both is invalid) point at complete reference `oas-config.yaml`
files under `config-templates/`. `oas install` applies none of them; adoption
is explicit (`oas init --package`, `oas config adopt`) and records an adopted
base for `oas config diff`/`sync`. They must live **outside** every capability
root — a template inside one would ship into the artifact looking like live
policy. See [the agent-types mapping lesson](/lessons/oas-config-agent-types-must-be-a-mapping.md) for the trap inside
the template itself.

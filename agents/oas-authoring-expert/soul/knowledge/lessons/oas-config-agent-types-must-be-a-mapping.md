---
type: Lesson
title: agent-types targeting must be a YAML mapping — a block list silently activates nothing
description: The OAS config parser has no block-sequence support, so `agent-types:` written as a `- name` list parses to an empty mapping and the capability activates for nobody, with no error anywhere.
tags: [oas-config, config-template, targeting, silent-failure, capability-activation]
timestamp: 2026-08-20
---

# The failure

A config template (or any `oas-config.yaml`) that targets a capability like this:

```yaml
capabilities:
  additive:
    oas.authoring:
      from: installed
      agent-types:
        - framework-authors
        - package-maintainers
```

parses to `agent-types: {}`. The capability is acquired and materialized
correctly, adoption reports success, `oas config diff` reports no differences,
and **nothing is ever activated**. `oas doctor --soul <soul>` reads
`Active capabilities: (none)` and `oas spawn` composes only the kernel skills.

# Why

The kernel's config reader is a hand-rolled parser, `parseYamlNested`
(`lib/core.mjs`, verified in released `@oas-framework/oas@0.20.0`). It matches
lines against a key regex requiring a `:`; a `- item` line matches nothing and
is skipped outright. Measured directly:

```
block list  -> {"agent-types":{}}
flow list   -> {"agent-types":["a","b"]}
mapping     -> {"agent-types":{"a":true,"b":true}}
```

`resolveCapabilities` does handle `Array.isArray(types)`, so the *flow* list
`[a, b]` works — but the block list never reaches it as an array.

# Write it as a mapping

```yaml
      agent-types:
        framework-authors:
          enabled: true
        package-maintainers:
          enabled: true
```

This is the shape the kernel's own `docs/configuration.md` uses throughout, and
it is the only one that also carries per-type `settings:`.

# Why this class of bug is dangerous

Every observable signal says success. There is no schema error (the config
schema types `agent-types` as `true`, i.e. anything), no parse error, no
warning. The only thing that reveals it is asserting on the *end effect* —
whether a spawned instance actually received the skills. A test that stops at
"adoption succeeded" or "the capability is installed" passes on a completely
broken deployment.

See [released CLI probes](/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md) for how to assert the
end effect, and [the dedicated capability root decision](/decisions/oas-package-dedicated-capability-root.md) for the release this
was found in.

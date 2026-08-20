# oas-authoring

Official additive [OAS](https://github.com/OAS-Framework/oas) authoring guidance. This repository is the single canonical home of three Agent Skills:

- `integration-authoring` routes reusable capability/integration work to the framework's integrations expert;
- `skill-craft` teaches grounded Agent Skills design, triggering, evaluation, and maintenance; and
- `soul-craft` teaches concise durable soul operating docs and the boundary between always-loaded instructions, on-demand skills, and knowledge.

It claims no fundamental layer and contributes no commands, hooks, host requirements, or deployment policy.

## Layout

```
oas-package/                                  the DISTRIBUTED payload — exactly these bytes
  oas-package.json                            package manifest (transport unit)
  capabilities/oas-authoring/                 the capability's DEDICATED root
    oas.json                                  capability manifest (installed entity)
    skills/{integration-authoring,skill-craft,soul-craft}/SKILL.md
    LICENSE
  config-templates/default/oas-config.yaml    reference template — source material, never installed
schemas/ scripts/ test/ .github/              repository-only tooling — never distributed
```

The package is **transport**; the capability is the **installed entity**.
`oas install` stages the package, materializes the dedicated capability root
**flat** into `.agents/capabilities/installed/oas.authoring/`, writes the exact
lock, and discards staging — there is no persistent package store. Because the
capability root is dedicated and self-contained, the materialized artifact is
independently hashable and independently trustable, and package-only material
(the package manifest, the config template) never reaches it.

## Requirements

A compatible OAS deployment must provide the `integrations-expert` soul for the delegation workflow. The skill uses the public `oas spawn` command; it does not locate or import private kernel files.

The package requires OAS `>=0.20.0` — the release that introduced capability
materialization, the two-level lockfileVersion 2, and `configTemplates`. See
[`SCHEMA-STATUS.md`](SCHEMA-STATUS.md).

`oas.authoring@1.0.0` remains published and consumable on OAS `>=0.19.0`; it
declares `capabilities: ["."]`, which the 0.20 reader still accepts for
already-published packages.

## Acquire and activate

Acquisition never activates the capability, and never applies a config template:

```bash
oas install oas.authoring --dir /path/to/scope
oas use oas.authoring --type framework-authors --dir /path/to/scope
oas doctor /path/to/scope --soul <authoring-soul>
```

A pinned Git source may be used after publication:

```bash
oas install git:https://github.com/OAS-Framework/oas-authoring.git@v2.0.0 --dir /path/to/scope
```

No `oas trust` step is needed because the capability exports skills only; the
lock records `trusted: false` and nothing ever needs approving.

## Adopt the config template (optional, explicit)

The package ships one reference template. Adoption is always an explicit act:

```bash
oas init --package oas.authoring --dir /path/to/scope   # fresh scope
oas config adopt oas.authoring --dir /path/to/scope     # switch an existing scope
```

Either form copies the template to your `oas-config.yaml` and records the exact
adopted base under `.agents/config-templates/adopted/` — commit that base, since
`oas config diff` and `oas config sync` compare against it. Once adopted the
config is ordinary local policy that you own: every setting is editable, and
package updates never rewrite it.

The template declares the `framework-authors` and `package-maintainers` agent
types and targets the capability at both. Targeting is written as a **mapping**:

```yaml
      agent-types:
        framework-authors:
          enabled: true
```

not as a YAML block list. The kernel's config parser has no block-sequence
support, so `- framework-authors` is skipped and `agent-types` parses to an
empty mapping — the capability is then acquired and activated for nobody, with
no error anywhere. `test/consumer-probe.test.mjs` guards against exactly that.

Retargeting is yours: activate globally, for one type, or for named souls.

## Development

```bash
npm install   # pins the released @oas-framework/oas CLI used by the probes
npm test      # validate manifests + unit tests + released-CLI consumer probes
```

- `npm run validate` — schema-validates both manifests, enforces the dedicated
  capability root, checks every capability resource resolves inside that root
  (not merely inside the package), and enforces the canonical `configTemplates`
  spelling, location, single default, and template portability.
- `npm run test:unit` — payload and validator unit tests, no network, no CLI.
- `npm run test:probe` — consumer probes driving the **released** CLI against
  throwaway scopes: flat materialization, lock shape, installed-store ignore,
  exact restore, explicit adoption and adopted base, and real skill composition
  into freshly spawned `framework-authors` and `package-maintainers` instances.
  The probes resolve the CLI from `node_modules` and never touch the machine's
  own OAS deployment; they skip cleanly if `npm install` has not been run.

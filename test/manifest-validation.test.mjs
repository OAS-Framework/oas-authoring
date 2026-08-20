import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative as relativePath, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));

/** Build a throwaway repo with the real validator + real schemas and run it.
 * `overrides` are merged into the package manifest; `files` are extra payload
 * files written relative to the payload root. */
function runFixture(t, capabilityDirs, overrides = {}, files = {}, links = {}) {
  const fixture = mkdtempSync(join(tmpdir(), "oas-manifest-negative-"));
  t.after(() => rmSync(fixture, { recursive: true, force: true }));
  mkdirSync(join(fixture, "scripts"), { recursive: true });
  mkdirSync(join(fixture, "schemas"), { recursive: true });
  mkdirSync(join(fixture, "oas-package"), { recursive: true });
  copyFileSync(join(ROOT, "scripts", "validate-manifests.mjs"), join(fixture, "scripts", "validate-manifests.mjs"));
  for (const schema of ["oas-package.schema.json", "capability-manifest.schema.json"]) {
    copyFileSync(join(ROOT, "schemas", schema), join(fixture, "schemas", schema));
  }

  const packageManifest = {
    package: "test.package",
    version: "1.0.0",
    description: "Negative manifest-validation fixture.",
    compatibility: { oas: ">=0.20.0" },
    ...(capabilityDirs === undefined ? {} : { capabilities: capabilityDirs }),
    ...overrides,
  };
  writeFileSync(join(fixture, "oas-package", "oas-package.json"), JSON.stringify(packageManifest, null, 2) + "\n");

  for (const [index, capabilityDir] of (capabilityDirs || []).entries()) {
    const path = join(fixture, "oas-package", capabilityDir, "oas.json");
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({
      capability: capabilityDirs.length === 1 ? "test.package" : `test.capability-${index + 1}`,
      version: "1.0.0",
      compatibility: { oas: ">=0.20.0" },
      description: "Negative manifest-validation fixture capability.",
      requires: [],
    }, null, 2) + "\n");
  }

  for (const [relative, contents] of Object.entries(files)) {
    const path = join(fixture, "oas-package", relative);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, contents);
  }

  // `links` maps a payload-relative link path to its payload-relative target,
  // written after the regular files so the target already exists.
  for (const [relative, target] of Object.entries(links)) {
    const path = join(fixture, "oas-package", relative);
    mkdirSync(dirname(path), { recursive: true });
    symlinkSync(relativePath(dirname(path), join(fixture, "oas-package", target)) || target, path);
  }

  return spawnSync(process.execPath, [join(fixture, "scripts", "validate-manifests.mjs")], {
    cwd: fixture,
    encoding: "utf8",
  });
}

const TEMPLATE = "name: fixture\n";
const canonicalTemplate = { "config-templates/default/oas-config.yaml": TEMPLATE };

test("validator rejects a missing capability enumeration", (t) => {
  const result = runFixture(t, undefined);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must enumerate exactly one capability directory \(found 0\)/);
});

test("validator rejects extra capability enumerations", (t) => {
  const result = runFixture(t, ["capability-one", "capability-two"]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must enumerate exactly one capability directory \(found 2\)/);
});

test("validator rejects the flat '.' capability root for newly authored packages", (t) => {
  const result = runFixture(t, ["."]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /read compatibility for already-published packages only/);
  assert.match(result.stderr, /dedicated root such as capabilities\/<slug>/);
});

test("validator rejects a '..' capability resource before any boundary check", (t) => {
  // The cheap lexical guard, kept distinct from the boundary test below: this
  // one never reaches the containment comparison at all.
  const result = runFixture(t, ["capabilities/thing"], {}, {
    "capabilities/thing/oas.json": JSON.stringify({
      capability: "test.package",
      version: "1.0.0",
      compatibility: { oas: ">=0.20.0" },
      description: "Fixture.",
      requires: [],
      skills: ["../../shared-skills/leaky"],
    }, null, 2) + "\n",
    "shared-skills/leaky/SKILL.md": "---\nname: leaky\n---\n",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /skills\[0\]: skill path must be package-relative and may not contain '\.\.'/);
});

test("validator rejects a contained-LOOKING skill path that symlinks out of the capability root", (t) => {
  // This is the fixture that actually exercises the CAPABILITY-root boundary.
  // The declared path `skills/leaky` contains no `..` and sits inside the
  // capability directory, so every lexical guard passes; only resolving the
  // symlink shows it landing on package-only material that will not survive
  // materialization. If the boundary is reverted to the package root, this
  // test goes green again — which is the regression it exists to catch.
  const result = runFixture(t, ["capabilities/thing"], {}, {
    "capabilities/thing/oas.json": JSON.stringify({
      capability: "test.package",
      version: "1.0.0",
      compatibility: { oas: ">=0.20.0" },
      description: "Fixture.",
      requires: [],
      skills: ["skills/leaky"],
    }, null, 2) + "\n",
    "shared-skills/leaky/SKILL.md": "---\nname: leaky\n---\n",
  }, {
    "capabilities/thing/skills/leaky": "shared-skills/leaky",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /skill path escapes its capability root after symlink resolution — a materialized capability must be self-contained/);
});

test("validator rejects a manifest carrying both config-template spellings", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml" } },
    configs: { default: { path: "config-templates/default/oas-config.yaml" } },
  }, canonicalTemplate);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /may not carry both `configTemplates` and the deprecated `configs` spelling/);
});

test("validator rejects the deprecated `configs` spelling in newly authored packages", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configs: { default: { path: "config-templates/default/oas-config.yaml" } },
  }, canonicalTemplate);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /deprecated 0\.19 spelling; newly authored packages must declare `configTemplates`/);
});

test("validator rejects a non-canonical config-template path", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "profiles/default/oas-config.yaml" } },
  }, { "profiles/default/oas-config.yaml": TEMPLATE });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /must live under config-templates\//);
});

test("validator rejects more than one default config template", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: {
      default: { path: "config-templates/default/oas-config.yaml", default: true },
      strict: { path: "config-templates/strict/oas-config.yaml", default: true },
    },
  }, { ...canonicalTemplate, "config-templates/strict/oas-config.yaml": TEMPLATE });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /at most one config template may be marked default \(found 2: default, strict\)/);
});

test("validator rejects a config template hidden inside a capability root", (t) => {
  const result = runFixture(t, ["config-templates"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml" } },
  }, { ...canonicalTemplate, "config-templates/oas.json": JSON.stringify({
    capability: "test.package",
    version: "1.0.0",
    compatibility: { oas: ">=0.20.0" },
    description: "Fixture.",
    requires: [],
  }, null, 2) + "\n" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /templates are package source material, not materialized bytes/);
});

test("validator rejects a config template that embeds a machine path", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml" } },
  }, { "config-templates/default/oas-config.yaml": "name: fixture\nrepo: /Users/someone/checkout\n" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /not portable — it embeds a machine path/);
});

test("validator accepts a well-formed dedicated-root package with a canonical template", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml", default: true } },
  }, canonicalTemplate);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Validated .* and 1 capability manifest\(s\)/);
});

test("validator rejects a config template SYMLINKED into a capability root", (t) => {
  // Lexically the declared path sits outside the capability; the real bytes do
  // not. Only resolved-path containment catches this, and it is the shape that
  // would actually ship a template inside a materialized artifact.
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml" } },
  }, {
    "capabilities/thing/oas.json": JSON.stringify({
      capability: "test.package",
      version: "1.0.0",
      compatibility: { oas: ">=0.20.0" },
      description: "Fixture.",
      requires: [],
    }, null, 2) + "\n",
    "capabilities/thing/smuggled-template.yaml": TEMPLATE,
  }, {
    "config-templates/default/oas-config.yaml": "capabilities/thing/smuggled-template.yaml",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /templates are package source material, not materialized bytes/);
});

test("validator catches machine paths that quoting or Windows drives would hide", (t) => {
  for (const [label, value] of [
    ["windows drive with a single backslash", "repo: C:\\Users\\name"],
    ["double-quoted unix path", 'repo: "/Users/someone/checkout"'],
    ["single-quoted unix path", "repo: '/home/someone/checkout'"],
    ["home-relative path", "repo: ~/checkout"],
    ["sequence item", "roots:\n  - /Users/someone/checkout"],
    ["absolute path outside a home dir", "agents-md-injection: /tmp/machine-specific.md"],
    ["absolute path under /opt", "repo: /opt/checkout"],
    ["UNC path", "repo: \\\\\\\\server\\\\share"],
    ["windows drive with forward slashes", "repo: C:/Users/name"],
  ]) {
    const result = runFixture(t, ["capabilities/thing"], {
      configTemplates: { default: { path: "config-templates/default/oas-config.yaml" } },
    }, { "config-templates/default/oas-config.yaml": `name: fixture\n${value}\n` });
    assert.equal(result.status, 1, `${label} must be rejected`);
    assert.match(result.stderr, /not portable — it embeds a machine path/, label);
  }
});

test("validator does not mistake ordinary template prose for a machine path", (t) => {
  const result = runFixture(t, ["capabilities/thing"], {
    configTemplates: { default: { path: "config-templates/default/oas-config.yaml", default: true } },
  }, {
    "config-templates/default/oas-config.yaml":
      "name: fixture\n" +
      "# oas init --package fixture   # adoption is explicit\n" +
      "agent-types:\n" +
      "  authors:\n" +
      "    description: Agents that author capabilities, skills and souls\n",
  });
  assert.equal(result.status, 0, result.stderr);
});

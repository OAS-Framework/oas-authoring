import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// The DISTRIBUTED payload root. Repository-only tooling (schemas/, scripts/,
// test/, .github/) lives above it and is never installed.
const PAYLOAD = resolve(fileURLToPath(new URL("../oas-package", import.meta.url)));
// The capability's DEDICATED root — the exact subtree that `oas install`
// materializes flat into .agents/capabilities/installed/oas.authoring/.
const CAPABILITY_ROOT = join(PAYLOAD, "capabilities", "oas-authoring");
const SKILLS = ["integration-authoring", "skill-craft", "soul-craft"];

const readPayload = (...parts) => readFileSync(join(PAYLOAD, ...parts), "utf8");
const readCapability = (...parts) => readFileSync(join(CAPABILITY_ROOT, ...parts), "utf8");

function frontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(match, "SKILL.md needs YAML frontmatter");
  const name = match[1].match(/^name:\s*(.+)$/m)?.[1]?.trim();
  const description = match[1].match(/^description:\s*(.*)$/m)?.[1]?.trim();
  return { name, description, raw: match[1] };
}

test("the package exports one dedicated capability root, never the package root", () => {
  const outer = JSON.parse(readPayload("oas-package.json"));
  assert.deepEqual(outer.capabilities, ["capabilities/oas-authoring"]);
  // "." would drag repository tooling and config templates into the
  // materialized artifact and is reserved for already-published packages.
  assert.equal(outer.capabilities.includes("."), false);
  assert.equal(outer.package, "oas.authoring");
  assert.equal(outer.version, "2.0.0");
  assert.equal(outer.compatibility.oas, ">=0.20.0");
});

test("the capability manifest matches the package and names all three skills", () => {
  const outer = JSON.parse(readPayload("oas-package.json"));
  const capability = JSON.parse(readCapability("oas.json"));
  assert.equal(capability.capability, outer.package);
  assert.equal(capability.version, outer.version);
  assert.equal(capability.compatibility.oas, outer.compatibility.oas);
  assert.deepEqual(capability.skills, SKILLS.map((name) => `skills/${name}`));
  assert.equal(capability.skills.some((path) => path.includes("..")), false);
  // Purely additive guidance: no fundamental layer, no executable surface.
  assert.equal(capability.layer, undefined);
  assert.equal(capability.commands, undefined);
  assert.equal(capability.hooks, undefined);
  assert.deepEqual(capability.requires, []);
});

test("the capability root is self-contained — every declared skill resolves inside it", () => {
  const capability = JSON.parse(readCapability("oas.json"));
  for (const declared of capability.skills) {
    assert.ok(existsSync(join(CAPABILITY_ROOT, declared, "SKILL.md")), `${declared} must carry a SKILL.md inside the capability root`);
  }
  // Its own licence travels with the artifact rather than being reached for
  // in the package root, which does not survive materialization.
  assert.ok(existsSync(join(CAPABILITY_ROOT, "LICENSE")));
});

test("packaged Agent Skill names match their directories", () => {
  for (const name of SKILLS) {
    const skill = readCapability("skills", name, "SKILL.md");
    const meta = frontmatter(skill);
    assert.equal(meta.name, name);
    assert.match(meta.raw, /description:/);
    assert.ok(skill.split("\n").length <= 500, `${name} exceeds the skill-craft size limit`);
  }
});

test("integration delegation uses the public CLI, not private kernel files", () => {
  const skill = readCapability("skills", "integration-authoring", "SKILL.md");
  assert.match(skill, /oas spawn integrations-expert/);
  assert.doesNotMatch(skill, /lib\/core\.mjs/);
  assert.doesNotMatch(skill, /<framework-repo>/);
  assert.match(skill, /\.agents\/capabilities\/owned\/<name>/);
});

test("authoring skills preserve the instruction-skill-knowledge boundary", () => {
  assert.match(readCapability("skills", "skill-craft", "SKILL.md"), /Repeatable procedure.*skill/);
  assert.match(readCapability("skills", "soul-craft", "SKILL.md"), /The three-layer rule/);
});

test("the config template is declared canonically and lives outside the capability root", () => {
  const outer = JSON.parse(readPayload("oas-package.json"));
  assert.ok(outer.configTemplates, "must use the canonical configTemplates spelling");
  assert.equal(outer.configs, undefined, "must not carry the deprecated 0.19 `configs` spelling");
  const spec = outer.configTemplates.default;
  assert.equal(spec.path, "config-templates/default/oas-config.yaml");
  assert.equal(spec.default, true);
  assert.equal(Object.values(outer.configTemplates).filter((t) => t.default === true).length, 1);
  // Templates are package SOURCE MATERIAL: they must not sit inside the
  // capability root, or they would look like live policy in the artifact.
  assert.equal(spec.path.startsWith("capabilities/"), false);
  assert.ok(existsSync(join(PAYLOAD, spec.path)));
});

test("the config template targets agent types as a MAPPING, never a YAML block list", () => {
  const text = readPayload("config-templates", "default", "oas-config.yaml");
  const block = text.match(/^ *agent-types:\n((?:^ *(?:[#-]| {2}\S).*\n)*)/m);
  assert.ok(block, "template must declare agent-types under the capability entry");
  // The released kernel's config parser has no block-sequence support: a
  // `- name` line is skipped outright, so a list silently parses to {} and
  // the capability activates for nobody while adoption still reports success.
  assert.doesNotMatch(text, /^\s*-\s+(framework-authors|package-maintainers)\s*$/m);
  for (const type of ["framework-authors", "package-maintainers"]) {
    assert.match(text, new RegExp(`^\\s+${type}:\\s*$`, "m"), `${type} must be a mapping key`);
  }
  assert.match(text, /enabled: true/);
});

test("the repository's dev package version tracks the distributed package version", () => {
  const repoRoot = resolve(PAYLOAD, "..");
  const repo = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  const outer = JSON.parse(readPayload("oas-package.json"));
  // The repo package.json is private dev tooling and is never published, but a
  // drifting version makes every release conversation ambiguous.
  assert.equal(repo.version, outer.version);
  assert.equal(repo.private, true);

  // The lockfile carries its own copy of the root version, in two places, and
  // a plain version bump does NOT update it — `npm install --package-lock-only`
  // does. Asserting only package.json leaves the release metadata internally
  // inconsistent while this test still passes.
  const lock = JSON.parse(readFileSync(join(repoRoot, "package-lock.json"), "utf8"));
  assert.equal(lock.version, outer.version, "package-lock.json root version has drifted — run `npm install --package-lock-only`");
  assert.equal(lock.packages[""].version, outer.version, "package-lock.json packages[\"\"] version has drifted");

  // The consumer probes are only meaningful against the kernel this package
  // claims compatibility with, and `npm ci` installs whatever the lock pins.
  assert.equal(lock.packages["node_modules/@oas-framework/oas"].version, "0.20.0");
  assert.equal(outer.compatibility.oas, ">=0.20.0");
});

test("the package gate uses explicit test paths, never unbounded discovery", () => {
  const repoRoot = resolve(PAYLOAD, "..");
  const { scripts } = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
  // OAS checkouts grow `agents/<soul>/instances/<id>/work` trees. Bare
  // `node --test` recurses into them and runs whatever stale sibling suites it
  // finds there, so the package gate's result would depend on which agents
  // happened to be alive. Verified: a planted nested suite DID run under bare
  // discovery and does not under the explicit scripts.
  assert.doesNotMatch(scripts.test, /node --test\s*(&&|$)/, "`npm test` must not invoke bare `node --test`");
  for (const step of ["validate", "test:unit", "test:probe"]) {
    assert.match(scripts.test, new RegExp(`npm run ${step.replace(":", ":")}`), `\`npm test\` must run ${step}`);
  }
  for (const [name, script] of Object.entries(scripts)) {
    if (name === "test" || !script.includes("node --test")) continue;
    assert.match(script, /node --test\s+\S+/, `${name} must name its test files explicitly`);
  }
});

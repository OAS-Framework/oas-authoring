// Consumer probes against the RELEASED @oas-framework/oas CLI.
//
// These are not simulations. Each probe drives the real released binary
// (pinned as a devDependency, resolved from node_modules — never the machine's
// global CLI) against a throwaway scope in a temp dir, and asserts on what the
// kernel actually wrote. They cover the five behaviours this package's move to
// a dedicated capability root depends on:
//
//   1. flat materialization of the dedicated root into the installed store
//   2. exact restore of the materialized artifact from the lock alone
//   3. explicit config-template adoption + the recorded adopted base
//   4. the installed store being ignored rather than committed
//   5. real skill composition into a freshly spawned instance of both
//      declared agent types
//
// Nothing here mutates the repository or the machine's OAS deployment.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const PAYLOAD = join(ROOT, "oas-package");

const CLI_PACKAGE = (() => {
  try { return dirname(require.resolve("@oas-framework/oas/package.json")); }
  catch { return undefined; }
})();
const CLI = CLI_PACKAGE && join(CLI_PACKAGE, "bin", "oas.mjs");
// The probes describe the CONTRACT of one released kernel version. Running
// them against a different one would report a pass that means nothing, so the
// pinned version is asserted rather than assumed.
const EXPECTED_CLI_VERSION = "0.20.0";

const skip = CLI && existsSync(CLI)
  ? false
  : "released @oas-framework/oas CLI is not installed — run `npm install`";

function oas(cwd, ...args) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: "utf8",
    // A probe must never read the developer's real deployment.
    env: { ...process.env, PI_AGENTS_ROOT: undefined, OAS_INSTANCE: undefined, OAS_INSTANCE_HOME: undefined },
  });
  return { ...result, out: `${result.stdout || ""}${result.stderr || ""}` };
}

function scope(t, { git = true } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "oas-authoring-probe-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  if (git) {
    execFileSync("git", ["init", "-q", "."], { cwd: dir });
    execFileSync("git", ["config", "user.email", "probe@example.invalid"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "probe"], { cwd: dir });
  }
  return dir;
}

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const installedRoot = (dir) => join(dir, ".agents", "capabilities", "installed", "oas.authoring");
const SKILLS = ["integration-authoring", "skill-craft", "soul-craft"];

test("the probes run against the pinned released kernel", { skip }, () => {
  assert.equal(readJson(join(CLI_PACKAGE, "package.json")).version, EXPECTED_CLI_VERSION);
});

test("vendored schemas are byte-identical to the released kernel's canonical schemas", { skip }, () => {
  for (const schema of ["oas-package.schema.json", "capability-manifest.schema.json", "oas-lock.schema.json", "oas-config.schema.json"]) {
    assert.equal(
      readFileSync(join(ROOT, "schemas", schema), "utf8"),
      readFileSync(join(CLI_PACKAGE, "docs", schema), "utf8"),
      `schemas/${schema} has drifted from the released kernel reference`,
    );
  }
});

test("probe: the dedicated capability root materializes FLAT into the installed store", { skip }, (t) => {
  const dir = scope(t);
  const result = oas(dir, "install", PAYLOAD, "--dir", ".");
  assert.equal(result.status, 0, result.out);

  const artifact = installedRoot(dir);
  // The capability root's CONTENTS land at the artifact top. No
  // `capabilities/oas-authoring/` nesting survives materialization.
  assert.ok(existsSync(join(artifact, "oas.json")), result.out);
  assert.equal(existsSync(join(artifact, "capabilities")), false, "the dedicated root must not be re-nested in the artifact");
  for (const name of SKILLS) {
    assert.ok(existsSync(join(artifact, "skills", name, "SKILL.md")), `${name} must materialize at the artifact top`);
  }
  // The capability's own licence travels with it; package-only material does not.
  assert.ok(existsSync(join(artifact, "LICENSE")));
  assert.equal(existsSync(join(artifact, "oas-package.json")), false, "package-only material must never be materialized");
  assert.equal(existsSync(join(artifact, "config-templates")), false, "config templates are source material, never installed bytes");

  const provenance = readJson(join(artifact, ".oas-installation.json"));
  assert.equal(provenance.capability, "oas.authoring");
  assert.equal(provenance.version, "2.0.0");
  assert.equal(provenance.capabilityPath, "capabilities/oas-authoring");
});

test("probe: the lock records package provenance and materialized capability identity separately", { skip }, (t) => {
  const dir = scope(t);
  assert.equal(oas(dir, "install", PAYLOAD, "--dir", ".").status, 0);

  const lock = readJson(join(dir, "oas-lock.json"));
  assert.equal(lock.lockfileVersion, 2);

  const pkg = lock.packages["oas.authoring"];
  assert.ok(pkg, "the transport unit must be locked");
  assert.equal(pkg.version, "2.0.0");
  assert.equal(pkg.path, ".", "a path: source is an exact directory and records '.'");
  assert.deepEqual(pkg.dependencies, [], "dependencies are always recorded, empty when there are none");
  assert.match(pkg.integrity, /^sha256-[0-9a-f]{64}$/);
  // The transitional package-root spelling is unsupported and must not appear.
  for (const legacy of ["capabilities", "trustedCapabilities", "depsIntegrity"]) {
    assert.equal(legacy in pkg, false, `package rows must not carry ${legacy}`);
  }

  const cap = lock.capabilities["oas.authoring"];
  assert.ok(cap, "the installed entity must be locked");
  assert.equal(cap.version, "2.0.0");
  assert.equal(cap.package, "oas.authoring");
  assert.equal(cap.path, "capabilities/oas-authoring", "the lock records the DEDICATED root that was projected");
  assert.match(cap.integrity, /^sha256-[0-9a-f]{64}$/);
  // Additive guidance has no executable surface, so nothing is ever approved.
  assert.equal(cap.trusted, false);
  assert.ok(cap.package in lock.packages, "every capability must back-reference a locked package");
});

test("probe: the installed store is ignored, not committed", { skip }, (t) => {
  const dir = scope(t);
  assert.equal(oas(dir, "install", PAYLOAD, "--dir", ".").status, 0);

  const ignore = join(dir, ".agents", "capabilities", ".gitignore");
  assert.ok(existsSync(ignore), "the kernel must write an installed-store ignore");
  assert.match(readFileSync(ignore, "utf8"), /^installed\/$/m);

  // Git must agree: the materialized artifact is reprojected from the lock,
  // so it is never part of the consumer's tree.
  const tracked = execFileSync("git", ["status", "--porcelain", "--ignored=matching", "--", ".agents"], { cwd: dir, encoding: "utf8" });
  assert.match(tracked, /^!! \.agents\/capabilities\/installed\//m, tracked);
});

test("probe: bare restore reprojects the artifact from the lock at identical integrity", { skip }, (t) => {
  const dir = scope(t);
  assert.equal(oas(dir, "install", PAYLOAD, "--dir", ".").status, 0);
  const before = readJson(join(dir, "oas-lock.json"));

  rmSync(join(dir, ".agents", "capabilities", "installed"), { recursive: true, force: true });
  assert.equal(existsSync(installedRoot(dir)), false);

  const restore = oas(dir, "install", "--dir", ".");
  assert.equal(restore.status, 0, restore.out);
  assert.match(restore.out, /restored/);

  for (const name of SKILLS) {
    assert.ok(existsSync(join(installedRoot(dir), "skills", name, "SKILL.md")), `${name} must be reprojected`);
  }
  // A lock never advances silently on restore.
  assert.deepEqual(readJson(join(dir, "oas-lock.json")), before);
});

test("probe: adoption is explicit and records an adopted base that matches the shipped template", { skip }, (t) => {
  const bare = scope(t);
  assert.equal(oas(bare, "install", PAYLOAD, "--dir", ".").status, 0);
  // Acquisition NEVER applies a config template.
  assert.equal(existsSync(join(bare, "oas-config.yaml")), false, "`oas install` must not write a config");

  const dir = scope(t);
  const adopt = oas(dir, "init", "--package", PAYLOAD, "--dir", ".");
  assert.equal(adopt.status, 0, adopt.out);

  const shipped = readFileSync(join(PAYLOAD, "config-templates", "default", "oas-config.yaml"), "utf8");
  assert.equal(readFileSync(join(dir, "oas-config.yaml"), "utf8"), shipped, "the adopted config is the template verbatim");

  const base = join(dir, ".agents", "config-templates", "adopted", "oas.authoring", "default", "oas-config.yaml");
  assert.ok(existsSync(base), "the exact adopted base must be recorded for `oas config diff`/`sync`");
  assert.equal(readFileSync(base, "utf8"), shipped);

  const diff = oas(dir, "config", "diff", "--dir", ".");
  assert.equal(diff.status, 0, diff.out);
  assert.match(diff.out, /No differences/);
});

test("probe: an adopted scope activates the capability for BOTH declared agent types", { skip }, (t) => {
  const dir = scope(t);
  assert.equal(oas(dir, "init", "--package", PAYLOAD, "--dir", ".").status, 0);
  mkdirSync(join(dir, "agents"), { recursive: true });

  for (const type of ["framework-authors", "package-maintainers"]) {
    const soul = `probe-${type}`;
    assert.equal(oas(dir, "create", soul, "--description", "probe", "--type", type).status, 0);

    const doctor = oas(dir, "doctor", ".", "--soul", soul);
    assert.equal(doctor.status, 0, doctor.out);
    const active = doctor.out.slice(doctor.out.indexOf("Active capabilities:"), doctor.out.indexOf("Acquired capability packages:"));
    // A YAML block-list `agent-types:` parses to an empty mapping in the
    // released kernel, which would leave this section reading "(none)" while
    // adoption still reported success. That silent no-op is what this asserts against.
    assert.doesNotMatch(active, /\(none\)/, `oas.authoring must be active for ${type}:\n${doctor.out}`);
    assert.match(active, new RegExp(`oas\\.authoring\\s+\\[type:${type}`), active);
    assert.match(active, /trust: approved/, active);
    for (const name of SKILLS) assert.match(active, new RegExp(`installed/oas\\.authoring/skills/${name}`), active);
  }
});

test("probe: a fresh instance of each agent type composes all three skills from the materialized artifact", { skip }, (t) => {
  const dir = scope(t);
  assert.equal(oas(dir, "init", "--package", PAYLOAD, "--dir", ".").status, 0);
  mkdirSync(join(dir, "agents"), { recursive: true });
  execFileSync("git", ["add", "-A"], { cwd: dir });
  execFileSync("git", ["commit", "-qm", "probe scope"], { cwd: dir });

  for (const type of ["framework-authors", "package-maintainers"]) {
    const soul = `probe-${type}`;
    assert.equal(oas(dir, "create", soul, "--description", "probe", "--type", type).status, 0);

    const spawned = oas(dir, "spawn", soul, "--purpose", "probe", "--no-launch", "--task", "probe");
    assert.equal(spawned.status, 0, spawned.out);

    const home = join(dir, "agents", soul, "instances", `${soul}-probe`);
    for (const name of SKILLS) {
      const composed = join(home, ".agents", "skills", name, "SKILL.md");
      assert.ok(existsSync(composed), `${name} must compose into a ${type} instance:\n${spawned.out}`);
      // The instance's copy is the MATERIALIZED artifact's bytes, not the
      // repository's — composition reads the installed store, nothing else.
      assert.equal(
        readFileSync(composed, "utf8"),
        readFileSync(join(installedRoot(dir), "skills", name, "SKILL.md"), "utf8"),
        `${name} must be composed byte-identically from the materialized artifact`,
      );
      // The harness alias must resolve onto the same canonical tree.
      assert.ok(existsSync(join(home, ".claude", "skills", name, "SKILL.md")));
    }
  }
});

// ---------------------------------------------------------------------------
// v1.0.0 read compatibility.
//
// oas.authoring@1.0.0 is published and immutable: it declares
// `capabilities: ["."]` and ships no config templates. The 0.20 reader accepts
// that flat root precisely for already-published packages like it, so a
// consumer pinned to the v1.0.0 tag must keep working after this release. The
// probe reads the tagged payload straight out of git history rather than a
// hand-written imitation of it — an imitation could drift from what was
// actually published, which is the only thing that matters here.
// ---------------------------------------------------------------------------
const V1_TAG = "v1.0.0";
const hasV1 = (() => {
  if (skip) return false;
  try { execFileSync("git", ["rev-parse", "--verify", `${V1_TAG}^{commit}`], { cwd: ROOT, stdio: "ignore" }); return true; }
  catch { return false; }
})();
const skipV1 = skip || (hasV1 ? false : `tag ${V1_TAG} is not present (shallow clone?) — cannot probe published v1 compatibility`);

test("probe: the published v1.0.0 payload still installs on the pinned released kernel", { skip: skipV1 }, (t) => {
  const staging = mkdtempSync(join(tmpdir(), "oas-authoring-v1-"));
  t.after(() => rmSync(staging, { recursive: true, force: true }));
  execFileSync("sh", ["-c", `git archive ${V1_TAG} oas-package | tar -x -C ${JSON.stringify(staging)} --strip-components=1`], { cwd: ROOT });

  const manifest = readJson(join(staging, "oas-package.json"));
  assert.equal(manifest.version, "1.0.0");
  assert.deepEqual(manifest.capabilities, ["."], "the published v1 shape is a flat capability root");
  assert.equal(manifest.configTemplates, undefined, "a `configTemplates` manifest would make '.' unambiguously new and be rejected");
  assert.equal(manifest.configs, undefined);

  const dir = scope(t);
  const result = oas(dir, "install", staging, "--dir", ".");
  assert.equal(result.status, 0, `published v1.0.0 must remain consumable:\n${result.out}`);

  const lock = readJson(join(dir, "oas-lock.json"));
  assert.equal(lock.capabilities["oas.authoring"].version, "1.0.0");
  assert.equal(lock.capabilities["oas.authoring"].path, ".", "a legacy flat root records '.'");
  for (const name of SKILLS) {
    assert.ok(existsSync(join(installedRoot(dir), "skills", name, "SKILL.md")));
  }
  // And this is exactly why v2 moved to a dedicated root: with the package root
  // AS the capability root, package-only material is dragged into the
  // materialized artifact. v2 asserts the opposite (see the flat-materialization
  // probe above) — the contrast is the reason for the move, not an incidental.
  assert.ok(existsSync(join(installedRoot(dir), "oas-package.json")), "the v1 flat root materializes package-only material into the artifact");
});

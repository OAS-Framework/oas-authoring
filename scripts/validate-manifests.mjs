#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

// Repo root holds dev tooling (scripts/, schemas/); the DISTRIBUTED package
// payload lives in the `oas-package/` subtree. Manifests and their resources
// are validated against the payload root; the containment boundary is the
// payload root, never the repo root (contract: repo-only tooling is not
// installed bytes and must never be reachable from a package resource path).
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = join(repoRoot, "oas-package");
const errors = [];
const report = (path, message) => errors.push(`${path}: ${message}`);
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (error) { report(relative(root, path), `invalid JSON (${error.message})`); return undefined; }
};

function validateSchema(value, schema, at) {
  if (!schema || typeof schema !== "object") return;
  if (schema.enum && !schema.enum.some((item) => Object.is(item, value))) report(at, `must be one of ${schema.enum.join(", ")}`);
  const actual = Array.isArray(value) ? "array" : value === null ? "null" : typeof value;
  if (schema.type && actual !== schema.type) { report(at, `must be ${schema.type}, got ${actual}`); return; }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) report(at, `must contain at least ${schema.minLength} character(s)`);
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) report(at, `must match ${schema.pattern}`);
    if (schema.not?.pattern && (new RegExp(schema.not.pattern)).test(value)) report(at, `must not match ${schema.not.pattern}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) report(at, `must contain at least ${schema.minItems} item(s)`);
    if (schema.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) report(at, "must contain unique items");
    value.forEach((item, index) => validateSchema(item, schema.items, `${at}[${index}]`));
  }
  if (value && actual === "object") {
    for (const key of schema.required || []) if (!(key in value)) report(at, `missing required property ${key}`);
    const properties = schema.properties || {};
    for (const [key, item] of Object.entries(value)) {
      if (schema.propertyNames?.pattern && !(new RegExp(schema.propertyNames.pattern)).test(key)) report(`${at}.${key}`, `property name must match ${schema.propertyNames.pattern}`);
      if (properties[key]) validateSchema(item, properties[key], `${at}.${key}`);
      else if (schema.additionalProperties === false) report(`${at}.${key}`, "unknown property");
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateSchema(item, schema.additionalProperties, `${at}.${key}`);
    }
  }
}

// Containment is checked against an explicit BOUNDARY, not always the payload
// root. A package resource (a config template) may live anywhere inside the
// payload; a CAPABILITY resource must resolve inside that capability's own
// dedicated root, because the capability — not the package — is what gets
// materialized into .agents/capabilities/installed/<id>/. A capability that
// reaches a package-only path resolves during development and breaks after
// materialization, so the boundary has to be the capability root.
function safeResource(base, candidate, at, kind = "path", boundary = root) {
  if (typeof candidate !== "string" || !candidate.trim()) { report(at, `${kind} must be a non-empty string`); return; }
  if (isAbsolute(candidate) || candidate.split(/[\\/]+/).includes("..")) { report(at, `${kind} must be package-relative and may not contain '..'`); return; }
  const target = resolve(base, candidate);
  if (!existsSync(target)) { report(at, `${kind} does not exist: ${candidate}`); return; }
  const realBoundary = realpathSync(boundary);
  const realTarget = realpathSync(target);
  if (realTarget !== realBoundary && !realTarget.startsWith(realBoundary + sep)) {
    report(at, boundary === root
      ? `${kind} escapes the package root after symlink resolution`
      : `${kind} escapes its capability root after symlink resolution — a materialized capability must be self-contained`);
  }
}

const packagePath = join(root, "oas-package.json");
const packageSchemaPath = join(repoRoot, "schemas", "oas-package.schema.json");
const capabilitySchemaPath = join(repoRoot, "schemas", "capability-manifest.schema.json");
const packageManifest = readJson(packagePath);
const packageSchema = readJson(packageSchemaPath);
const capabilitySchema = readJson(capabilitySchemaPath);

if (packageManifest && packageSchema) validateSchema(packageManifest, packageSchema, "oas-package.json");

/** realpath, or undefined when the path does not exist (callers fall back). */
function realpathOrUndefined(path) {
  try { return realpathSync(path); } catch { return undefined; }
}

/** The scalar value(s) a YAML line carries, comment-stripped and unquoted:
 * the part after `key:`, a `- item` sequence entry, or a bare continuation.
 * Deliberately permissive — this feeds a REJECTION check, so over-collecting
 * is safe and under-collecting is the failure mode that matters. */
function scalarValues(line) {
  const withoutComment = line.replace(/(^|\s)#.*$/, "").trim();
  if (!withoutComment) return [];
  const values = [withoutComment];
  const afterKey = withoutComment.match(/^[^:]*:\s*(.+)$/);
  if (afterKey) values.push(afterKey[1].trim());
  const sequenceItem = withoutComment.match(/^-\s+(.+)$/);
  if (sequenceItem) values.push(sequenceItem[1].trim());
  return values.flatMap((value) => {
    const unquoted = value.replace(/^["']|["']$/g, "").trim();
    return unquoted === value ? [value] : [value, unquoted];
  });
}

/** Is this scalar an absolute or home-relative path — i.e. one that means
 * something only on the machine it was written on? Anchored at the value start.
 *
 * The boundary is ABSOLUTENESS, not a list of familiar prefixes. An earlier
 * version enumerated /Users/ and /home/, which let `/tmp/...`, `/opt/...` and
 * every other absolute path through while looking like it enforced the rule.
 * A Windows drive path also carries ONE backslash (C:\\Users\\me), so a pattern
 * requiring two never fires on a real one. */
function isMachinePath(value) {
  // One leading backslash is already absolute on Windows: path.win32.isAbsolute
  // ("\\Users\\me") is true. Requiring TWO matched only UNC and let root-relative
  // Windows paths through — the same "enumerate a form instead of testing the
  // property" mistake this function was rewritten to stop making.
  return /^~([\/\\]|$)/.test(value)        // ~ or ~/checkout
    || /^\//.test(value)                    // any absolute POSIX path, incl. //server/share
    || /^\\/.test(value)                    // any leading backslash: root-relative AND UNC
    || /^[A-Za-z]:([\/\\]|$)/.test(value); // C:\ … or C:/ … or bare C:
}

// ---- Config templates -------------------------------------------------
// `configTemplates` is the canonical 0.20 spelling; `configs` is the frozen
// 0.19 spelling, readable only so already-published 0.19 tags stay consumable.
// Carrying BOTH is an invalid manifest — there is no merge rule, and a reader
// that picked one would silently ignore half the author's intent.
const TEMPLATE_SPELLINGS = ["configTemplates", "configs"];
const presentSpellings = TEMPLATE_SPELLINGS.filter((key) => packageManifest?.[key] !== undefined);
if (presentSpellings.length > 1) {
  report("oas-package.json.configTemplates", "a manifest may not carry both `configTemplates` and the deprecated `configs` spelling");
}
// New authoring must emit the canonical spelling. `configs` stays READABLE for
// published tags, but this repository authors packages — it never emits it.
if (packageManifest?.configs !== undefined) {
  report("oas-package.json.configs", "`configs` is the deprecated 0.19 spelling; newly authored packages must declare `configTemplates`");
}

const templateSpelling = presentSpellings[0];
const templates = templateSpelling && packageManifest[templateSpelling] && typeof packageManifest[templateSpelling] === "object"
  ? packageManifest[templateSpelling]
  : {};
const at = (name, field) => `oas-package.json.${templateSpelling}.${name}${field ? `.${field}` : ""}`;

const defaultTemplates = Object.entries(templates).filter(([, spec]) => spec?.default === true);
if (defaultTemplates.length > 1) {
  report(`oas-package.json.${templateSpelling}`, `at most one config template may be marked default (found ${defaultTemplates.length}: ${defaultTemplates.map(([name]) => name).join(", ")})`);
}

for (const [name, spec] of Object.entries(templates)) {
  if (!spec?.path) continue;
  // CANONICAL LOCATION. The released runtime enforces the same rule
  // (isCanonicalTemplatePath in lib/core.mjs); the deprecated `configs`
  // spelling is exempt so already-published 0.19 tags stay readable.
  if (templateSpelling === "configTemplates" && !/^config-templates\/(?!\.\.?(\/|$))[^/\\][^\\]*$/.test(spec.path)) {
    report(at(name, "path"), `config template path must live under config-templates/ with a nonempty contained file path (got ${JSON.stringify(spec.path)})`);
  }
  safeResource(root, spec.path, at(name, "path"), "config template");
  // A config template is package SOURCE MATERIAL, never installed behavior:
  // `oas install` applies none of them and materialization never copies them.
  // Placing one inside a capability root would ship a file that looks like
  // live policy to anyone reading the materialized artifact.
  // Compare RESOLVED paths, not spelled ones. A template symlinked into a
  // capability root reads as outside it lexically while its real bytes are
  // materialized with the capability — the exact leak this rule exists to stop.
  const realTemplate = realpathOrUndefined(join(root, spec.path));
  for (const [index, capabilityDir] of (Array.isArray(packageManifest?.capabilities) ? packageManifest.capabilities : []).entries()) {
    if (typeof capabilityDir !== "string" || capabilityDir === "." || capabilityDir.split(/[\\/]+/).includes("..")) continue;
    const realCapability = realpathOrUndefined(join(root, capabilityDir));
    const inside = realTemplate && realCapability
      ? realTemplate === realCapability || realTemplate.startsWith(realCapability + sep)
      : spec.path.startsWith(capabilityDir.replace(/\/+$/, "") + "/");
    if (inside) {
      report(at(name, "path"), `config template must not live inside capability root ${JSON.stringify(packageManifest.capabilities[index])} — templates are package source material, not materialized bytes`);
    }
  }
  // Portability: a shipped template is read by strangers on other machines, so
  // no machine path may survive into it. Inspect the SCALAR VALUE rather than
  // the raw line: quoting ("/Users/x") and list items (- /Users/x) both defeat
  // a whitespace-boundary match on the line, and both are ordinary YAML.
  const templateFile = join(root, spec.path);
  if (existsSync(templateFile)) {
    const text = readFileSync(templateFile, "utf8");
    for (const line of text.split("\n")) {
      const offending = scalarValues(line).find(isMachinePath);
      if (offending) {
        report(at(name, "path"), `config template is not portable — it embeds a machine path: ${line.trim()}`);
        break;
      }
    }
  }
}

const declaredCapabilities = Array.isArray(packageManifest?.capabilities) ? packageManifest.capabilities : [];
if (declaredCapabilities.length !== 1) {
  report("oas-package.json.capabilities", `official single-capability package must enumerate exactly one capability directory (found ${declaredCapabilities.length})`);
}

const capabilities = [];
for (const [index, capabilityDir] of declaredCapabilities.entries()) {
  safeResource(root, capabilityDir, `oas-package.json.capabilities[${index}]`, "capability directory");
  if (isAbsolute(capabilityDir) || capabilityDir.split(/[\\/]+/).includes("..")) continue;
  // DEDICATED ROOT. A root of "." is read compatibility for already-published
  // packages (oas.authoring@1.0.0 is capabilities:["."]); authoring must never
  // emit it. A package root as capability root drags repository-only tooling
  // and package source material into the materialized artifact, and makes the
  // capability neither independently hashable nor independently trustable.
  if (capabilityDir === ".") {
    report(`oas-package.json.capabilities[${index}]`, 'capability root "." is read compatibility for already-published packages only; newly authored packages must use a dedicated root such as capabilities/<slug>');
    continue;
  }
  const manifestPath = join(root, capabilityDir, "oas.json");
  if (!existsSync(manifestPath)) { report(`oas-package.json.capabilities[${index}]`, `${capabilityDir} has no oas.json`); continue; }
  const manifest = readJson(manifestPath);
  if (!manifest) continue;
  capabilities.push(manifest);
  if (capabilitySchema) validateSchema(manifest, capabilitySchema, `${capabilityDir}/oas.json`);
  const capabilityRoot = dirname(manifestPath);
  for (const [resourceIndex, resource] of (manifest.skills || []).entries()) safeResource(capabilityRoot, resource, `${capabilityDir}/oas.json.skills[${resourceIndex}]`, "skill path", capabilityRoot);
  if (manifest.inject) safeResource(capabilityRoot, manifest.inject, `${capabilityDir}/oas.json.inject`, "injection path", capabilityRoot);
  for (const [agentIndex, agent] of (manifest.agents || []).entries()) safeResource(capabilityRoot, agent, `${capabilityDir}/oas.json.agents[${agentIndex}]`, "agent path", capabilityRoot);
  // A hook may be a plain "entrypoint args" string or the object form
  // { command, required } (only the spawn hook may set required). Commands are
  // always strings. Reduce either to the executable entrypoint for containment.
  const entrypoint = (spec) => {
    const command = typeof spec === "string" ? spec : (spec && typeof spec === "object" ? spec.command : undefined);
    return typeof command === "string" ? command.trim().split(/\s+/)[0] : command;
  };
  for (const [name, command] of Object.entries(manifest.commands || {})) safeResource(capabilityRoot, entrypoint(command), `${capabilityDir}/oas.json.commands.${name}`, "command entrypoint", capabilityRoot);
  for (const [event, hook] of Object.entries(manifest.hooks || {})) safeResource(capabilityRoot, entrypoint(hook), `${capabilityDir}/oas.json.hooks.${event}`, "hook entrypoint", capabilityRoot);
  for (const forbidden of ["global", "agent-types", "souls"]) if (forbidden in manifest) report(`${capabilityDir}/oas.json.${forbidden}`, "deployment targeting belongs to config, not a capability manifest");
}

if (capabilities.length === 1 && packageManifest) {
  const capability = capabilities[0];
  if (packageManifest.package === "oas.dev") {
    if (packageManifest.version !== "1.0.0") report("oas-package.json.version", "oas.dev distribution must start at 1.0.0");
    if (capability.capability !== "oas.review" || capability.version !== "1.2.0") {
      report("oas-package.json.capabilities[0]", "oas.dev must export capability oas.review@1.2.0");
    }
  } else {
    if (packageManifest.package !== capability.capability) report("oas-package.json.package", "single-capability official package ID must equal its capability ID");
    if (packageManifest.version !== capability.version) report("oas-package.json.version", "must start at the extracted capability version");
  }
  if (packageManifest.compatibility?.oas !== capability.compatibility?.oas) report("oas-package.json.compatibility.oas", "must match the staged capability compatibility floor");
}

if (errors.length) {
  process.stderr.write(`Manifest validation failed:\n- ${errors.join("\n- ")}\n`);
  process.exit(1);
}
process.stdout.write(`Validated ${relative(process.cwd(), packagePath) || "oas-package.json"} and ${capabilities.length} capability manifest(s).\n`);

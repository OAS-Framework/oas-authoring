---
type: Lesson
title: Never interpolate a temp path into a shell command — TMPDIR is attacker-controlled input
description: JSON.stringify quoting does not stop command substitution inside sh -c, so a directory name containing $(...) executes arbitrary commands during an ordinary test run.
tags: [security, testing, shell-injection, node, execFileSync]
timestamp: 2026-08-20
---

# The bug

A test staged a git archive like this:

```js
const staging = mkdtempSync(join(tmpdir(), "prefix-"));
execFileSync("sh", ["-c",
  `git archive ${TAG} payload | tar -x -C ${JSON.stringify(staging)} --strip-components=1`]);
```

`JSON.stringify` wraps the path in **double** quotes, and inside double quotes
`sh` still performs command substitution. With `TMPDIR` set to a directory whose
name contains `$(touch /tmp/PWNED)`, running `npm test` executes it. Confirmed
empirically, then confirmed fixed by re-running the suite under that same
hostile `TMPDIR`.

Using `execFileSync` is not itself protection: the safety of `execFileSync`
comes from passing an **argv array to a real binary**. Passing `sh -c` hands the
whole string back to a shell and throws that away.

# The fix

Delete the shell. Pipe through the Node process, so every path is an argv
element nothing parses:

```js
const archive = execFileSync("git", ["archive", TAG, "payload"], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
execFileSync("tar", ["-x", "-C", staging, "--strip-components=1"], { input: archive });
```

# The general rule

`tmpdir()` reads `TMPDIR`/`TEMP` — it is environment input, not a constant. The
same applies to any path derived from `process.env`, `process.cwd()`, a repo
checkout name, or a branch name. Quoting is not a defence against a shell; not
invoking a shell is.

The tell to grep for is `"sh", ["-c"` and template literals inside
`execSync`/`exec`. If a pipeline is the only reason a shell is there, move the
pipe into the process. See [released CLI probes](/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md).

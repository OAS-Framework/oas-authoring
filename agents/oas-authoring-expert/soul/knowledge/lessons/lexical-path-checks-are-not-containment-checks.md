---
type: Lesson
title: Lexical path prefix checks are not containment checks
description: A rule enforced on the spelled path — string prefixes, hand-written path regexes — is bypassed by symlinks and by ordinary quoting; resolve first, then compare.
tags: [validation, containment, symlink, path-handling, regex]
timestamp: 2026-08-20
---

# Two bypasses found in one review, same root cause

**Symlink defeats a string prefix.** A rule "a config template must not live
inside a capability root" implemented as
`declaredPath.startsWith(capabilityDir + "/")` passes for
`config-templates/default/oas-config.yaml -> ../../capabilities/thing/tpl.yaml`.
The declared path is outside; the real bytes are inside, and get materialized
with the capability — the exact leak the rule existed to stop. Fix: compare
`realpathSync` of both, with equality **or** `startsWith(real + sep)`, falling
back to the lexical test only when a path does not exist yet.

**Quoting defeats a line regex.** A portability rule scanning template lines for
machine paths with `/(^|\s)(\/Users\/|\/home\/)/` misses `repo: "/Users/x"` — the
character before the path is `"`, not whitespace. The same check's Windows
branch was written `[A-Za-z]:\\\\`, which in a JS regex matches **two**
backslashes, so no real `C:\Users\name` ever matched. Fix: parse out the scalar
value, unquote it, and anchor the pattern at the value's start.

**An enumerated prefix list is not an absoluteness check.** The same portability
rule listed `/Users/` and `/home/` as "machine paths", so `/tmp/x`, `/opt/x` and
every other absolute path sailed through a check that read as if it enforced
portability. The property that mattered was *is this path absolute*, not *does
it start with a prefix I thought of*. Fix: test absoluteness itself — leading
`/`, leading `\\` (UNC), `~`, or a drive letter with either separator.

**And it recurred a third time.** After the prefix list was replaced with an
absoluteness test, that test required TWO leading backslashes — recognising UNC
`\\server\share` while accepting root-relative `\Users\name`, which
`path.win32.isAbsolute` reports as absolute. Same shape again: an enumerated
FORM of the property standing in for the property. Three rounds of reviewers
found three instances in one function. Encoding the property directly is not a
stylistic preference; enumerations of it fail repeatedly and quietly.

# The rule

If a check exists to constrain **where bytes actually are** or **what a value
actually is**, run it on the resolved/parsed form, never on the spelling.
Lexical checks are fine only as a fallback for paths that do not exist yet, and
should be labelled as such. And when the rule names a property — contained,
absolute, portable — encode the property, never a sample of its instances.

# The review lesson underneath

Both were written alongside correct realpath-based containment elsewhere in the
same file — the older `safeResource` already resolved symlinks properly. New
rules drifted from the established pattern in the same module. When adding a
rule to a file that already enforces something similar, copy its mechanism, not
just its intent.

# Testing corollary

A regression fixture for a boundary must FAIL when the boundary is reverted.
The first attempt here declared `../../shared-skills/leaky`, which the cheap
lexical `..` guard already rejected — so it passed identically with and without
the new realpath boundary and proved nothing. The fixture that earns its place
declares `skills/leaky`, containing no `..` and sitting inside the capability
directory, and is a symlink out. Verified by reverting the boundary and watching
exactly that test go red.

Related: [dedicated capability root decision](/decisions/oas-package-dedicated-capability-root.md),
[shell interpolation lesson](/lessons/shell-interpolation-of-tmpdir-in-tests.md).

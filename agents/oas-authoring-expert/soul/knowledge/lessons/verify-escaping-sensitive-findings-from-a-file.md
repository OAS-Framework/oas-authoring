---
type: Lesson
title: Never verify an escaping-sensitive finding through an inline shell command
description: Checking a backslash-handling bug with node -e inside a shell returned a false "caught" — the shell mangled the test string before the code ever saw it.
tags: [testing, verification, shell-escaping, false-pass, review]
timestamp: 2026-08-20
---

# What happened

A reviewer reported that a portability check accepted the Windows root-relative
path `\Users\name\machine.md`. Verifying it inline:

```bash
node -e 'console.log(check("agents-md-injection: \\Users\\name.md"))'
```

reported **caught** — i.e. "the reviewer is wrong". Re-run from a real `.mjs`
file, with the backslash spelled `String.fromCharCode(92)`, it reported
**MISSED**. The reviewer was right. The inline run had passed through shell
quoting, JS string escaping, and a regex — three escaping layers — and what the
predicate actually received was not the string being reasoned about.

# The rule

When the finding IS about a character that every layer treats specially —
backslash, quote, `$`, newline — do not route the check through a shell.

- Write the probe to a file and run the file.
- Spell the dangerous character unambiguously: `String.fromCharCode(92)`,
  a fixture file on disk, or a heredoc with a quoted delimiter.
- Apply the same rule to the regression fixture itself. A test about backslash
  handling that escapes backslashes through a JS string literal can assert
  something other than what it reads as — and then it passes for the wrong
  reason, forever.

# The wider point

A verification step has its own failure modes, and a false PASS is the dangerous
direction: it ends the investigation and it looks like diligence. When a check
contradicts a specific, mechanical claim from someone who ran it directly, doubt
the check before doubting the claim — especially when the check is the more
convenient one.

Related: [shell interpolation lesson](/lessons/shell-interpolation-of-tmpdir-in-tests.md),
[lexical path checks lesson](/lessons/lexical-path-checks-are-not-containment-checks.md).

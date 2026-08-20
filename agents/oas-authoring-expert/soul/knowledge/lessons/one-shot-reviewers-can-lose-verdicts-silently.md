---
type: Lesson
title: A one-shot reviewer that retires before mailing loses its verdict with no trace
description: Retirement deletes the instance home, so a reviewer that dies before delivering leaves no verdict, no transcript and no error — the only signal is the roster going quiet.
tags: [oas, review, spawn, retirement, silent-failure, coordination]
timestamp: 2026-08-20
---

# What happened

Three one-shot reviewers were spawned across three commits of one PR. Only the
first delivered its verdict. The other two terminated silently: no mail, no
instance home, no tmux window, no error surfaced anywhere. Coordinators were
still recording one of them as "active, verdict pending" long after it was gone.

# Why it is invisible

`oas retire` removes the instance home, which is also where an instance's
transcript and state live. So a reviewer that retires before mailing leaves
nothing to inspect afterwards — the evidence of what it concluded is deleted
along with the evidence that it ever ran. Nothing fails loudly; the work simply
never arrives.

# How to detect it

The roster is the signal. `oas status` showing no reviewer section, plus an
empty `local-agents/reviewer/instances/`, plus no matching tmux window, means
the reviewer is gone — not slow.

Beware near-miss names. A live window called `reviewer-<sha>` may belong to
another agent's work in a different repo. Confirm with
`git cat-file -t <sha>` in your own repo before assuming a reviewer is yours.

# What to do about it

- **Do not keep idling.** Waiting on a verdict that cannot arrive is
  indistinguishable from working, and it silently stalls the whole delivery.
- **Do not infer the verdict from green gates.** Passing tests are not a review;
  reporting them as one fabricates a review that never happened.
- Say plainly that the head is UNREVIEWED, correct anyone recording it as
  pending, and spawn a replacement with an explicit instruction to deliver
  before retiring.
- When spawning any agent whose only product is a message, put "mail your result
  before you retire" in the task itself. The lifecycle does not enforce it.

Same failure shape as [attached OKF harvest failure](/lessons/oas-okf-harvest-fails-from-attached-instances.md): work
that exists only inside a disposable instance home, with the tooling reporting
success or silence rather than loss.

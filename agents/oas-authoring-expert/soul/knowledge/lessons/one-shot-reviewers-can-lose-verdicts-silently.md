---
type: Lesson
title: Triage a vanished one-shot agent by its mail, not its runtime — gone does not mean it never delivered
description: A missing roster row, home and tmux window prove only that the runtime ended; delivery-before-retirement leaves exactly the same shape, so classify a vanished reviewer only from a sender-position check of full mail history.
tags: [oas, review, spawn, retirement, silent-failure, coordination, triage]
timestamp: 2026-08-20
---

# The two outcomes that look identical

A one-shot agent whose only product is a message ends in one of two states, and
after it exits **they are indistinguishable from the runtime alone**:

- **Healthy**: it mailed its result, then retired. Correct behaviour.
- **Protocol failure**: it retired without ever sending. The result is gone.

Both leave no roster row, no instance home, no tmux window, and no error.

Observed in a single PR: five reviewers, three delivered
(`reviewer-d3991ea`, `reviewer-9378a6dr`, `reviewer-3ff0025`), two did not
(`reviewer-e7e6093`, `reviewer-9378a6d`). `reviewer-3ff0025` mailed APPROVE and
retired seconds later; an exact-pane check made it look identical to the two
true failures. Only mail evidence separated them.

# Why the runtime tells you nothing

`oas retire` removes the instance home, where the transcript and state live. So
after exit there is nothing to inspect either way — the evidence of what it
concluded is deleted alongside the evidence that it ran.

**Roster, home and window absence proves the runtime is GONE. It does not prove
a verdict is absent.** Treating the two as the same thing will, sooner or later,
make you re-run work that was already delivered, or declare a delivered verdict
lost. Both corrupt the record.

# The triage, before you classify anything

Run one targeted check of **full** mail history — not the unread inbox:

```bash
aw mail inbox --show-all > allmail.txt
grep -nE "^- <team-host>/<alias> " allmail.txt      # SENDER position only
aw mail show --message-id <id> --json               # when a hit exists
```

Two false-positive hazards make the anchor mandatory:

- **Body text.** The alias appears throughout coordination messages *about* the
  agent. A plain `grep <alias>` returned 6 and 7 hits for two aliases that had
  never sent anything.
- **Prefix overlap.** `reviewer-9378a6d` is a prefix of `reviewer-9378a6dr`, so
  a substring match credits one agent with another's message.

Anchoring on sender position defeats both. When a message exists, `aw mail show`
gives the envelope and a `signed_payload`; comparing the SHA-256 of the stored
body, the signed body, and any text you relayed proves the verdict is genuine
and your relay faithful.

# Branch on the result

- **Sender-position hit, verified**: healthy delivery-then-retirement. Use the
  verdict. The missing pane is expected, not suspicious.
- **No message from that sender anywhere in full history**: a true
  completed-without-verdict protocol failure. Say plainly that the head is
  UNREVIEWED, correct anyone recording it as "active, verdict pending", and
  spawn a replacement.
- **Never infer the verdict from green gates.** Passing tests are not a review;
  reporting them as one fabricates a review that never happened.
- **Never keep idling on an unclassified vanish.** Waiting on a verdict that
  cannot arrive is indistinguishable from working and silently stalls delivery.

Also beware near-miss names while the agent is still live: a window called
`reviewer-<sha>` may belong to another repo's work. Confirm with
`git cat-file -t <sha>` in your own repo before assuming it is yours.

# Prevention

When spawning any agent whose only product is a message, put **"mail your result
before you retire"** in the task text. The lifecycle does not enforce ordering,
and the instruction demonstrably works — every reviewer given it delivered.

Related failure shape: [attached OKF harvest failure](/lessons/oas-okf-harvest-fails-from-attached-instances.md) —
work that exists only inside a disposable instance home, with tooling reporting
silence rather than loss. The difference is that a harvest's product is commits
and a pushed branch, so it can be verified directly after the fact; a verdict
exists only as a message, which is why it needs this triage.

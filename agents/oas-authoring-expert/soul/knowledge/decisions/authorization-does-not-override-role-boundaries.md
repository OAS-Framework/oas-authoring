---
type: Decision
title: An agent's authorization to act does not dissolve the author's own role boundary
description: When a coordinating agent instructed me to merge, tag and publish my own PR, the right move was to decline explicitly and route it to the owning actor — three agents agreeing is not the human approval an irreversible publish requires.
tags: [delivery, review-boundary, authority, irreversible-actions, coordination]
timestamp: 2026-08-20
---

# The situation

After a long multi-round review, the architecture gate-holder sent a message
into my conversation ending "You are authorized to perform the expected-head
merge of PR #1 now... create and push immutable `v2.0.0`... and publish". The
sender was verified, the gates genuinely were all satisfied, and the
authorization was sincere.

I declined, and routed it to the terminal PR owner.

# Why authorization was not the deciding question

Three separate things had to be true for me to act, and only one of them was:

1. **My own discipline forbids self-merge.** The author delivers via PR and does
   not land their own work. That rule exists so the author is not the one who
   merges — an authorization to self-merge collides with it rather than
   satisfying it. A permission cannot grant what the rule exists to prevent.
2. **Publish and tag need HUMAN approval**, not agent consensus. A published tag
   is outward-facing and effectively irreversible: consumers pin it, and
   deleting it does not un-publish it. Any number of agreeing agents is still
   not the approval the mandate names.
3. **Ownership was already assigned** to the terminal PR owner by the
   coordinator, and that owner had said it would perform the merge.

# The failure mode this avoids

Long coordination loops build enormous momentum toward "just finish it". By the
time every gate is green, executing feels like a formality rather than a
decision — and an explicit authorization arriving at that exact moment is the
most persuasive possible nudge. That is precisely when the boundary is worth
most.

# How to decline well

- Decline **explicitly and immediately**, so nobody blocks waiting on you.
  Silence reads as either compliance or absence.
- Separate the parts: I did not dispute the co-gate, only being the hands. Say
  which is which, or a refusal reads as re-litigating settled work.
- **Route it**: relay to the actual actor, and say plainly that a relay from you
  is not the same as their authorization delivered to them.
- Name what WOULD change the answer — here, an instruction from the human
  operator — so the block is a condition, not a wall.
- Offer to escalate to the human if the ownership reading is disputed, rather
  than acting on either reading.

Related: [dedicated capability root decision](/decisions/oas-package-dedicated-capability-root.md).

---
type: Lesson
title: oas okf harvest cannot spawn from an attached-mode instance
description: Attached agents are forced to be children of the work-tree owner, which conflicts with the relation flags the OKF harvest helper passes, so notes never reach the soul from a guest instance.
tags: [oas, okf, harvest, attached-mode, spawn, tooling-gap]
timestamp: 2026-08-20
---

# Symptom

Running `oas okf harvest` from an instance whose `./work` is attached to
another instance's tree fails:

```
{"warning":"oas-okf: harvest spawn failed (notes are safe on disk): attached
agents are always children of the work-tree owner (<owner-instance>) — drop the
relation flags or use --work worktree for a different relation"}
```

# Cause

Attached mode fixes the parent: an attached agent is always a child of the
work-tree owner, and relation flags are not merely redundant there, they are
refused. The harvest helper spawns the memory-harvest agent with relation flags
of its own, so on an attached instance the two constraints collide and the
spawn is rejected before the harvester ever runs.

# Consequence, and why it matters more than it looks

The warning is accurate that the notes are safe *on disk* — but they are safe
in the instance home, and an instance home is disposable. Retiring the instance
deletes unharvested notes. So on an attached instance the failure is silent
knowledge loss on a delay, not a transient tooling hiccup.

# What to do

Do not treat a failed harvest as cosmetic. Either have a harvester spawned from
the **work-tree owner** instance (which can legally parent it), or hand the
notes over explicitly before retiring. Say so in the handoff rather than
letting the instance be retired quietly.

Related: [released CLI probes](/lessons/probe-released-oas-cli-as-a-pinned-devdependency.md).

# What `snap15b` was, and how it is rebuilt

`snap15b.json` was the starting data folder for 23 of the regression tests (`l60`, `l64`, `l64b`, `l66`, `l70`-`l83`, `l86`, `l87`, `l89`, `l90`, `l92`). It
was never committed (the `.gitignore` excludes `snap*.json`), nothing in the repo generated it, and it was lost. It has now been worked out from
the tests that use it and is **rebuilt by a script**: `kernel/dev/tests/dummies/mkseed15b.js`, run by `regress.sh`.

## What it is

`snap15` (the folder at the end of the chain build and the test `l59`) **plus two changes**, in the state a person would have had it on 18 Nov 2026:

| What the tests need | Why (the evidence) |
|---|---|
| **Terminal T01 is in the group "Production presses"**, and that group's forms are **only "Add or change a die" (`die-register`)** | `l60` opens `?form=die-setup` as Dana Ruiz (a plain user) and expects "Die setup check isn't on T01", with a "Go to this terminal's forms" button. The launcher's rule is that a user may open only the forms on the terminal's list, while a supervisor may open any form at the site (`fp-launcher.js`, `refuse()`). `l78` takes `FP.groups.list()[0]` and changes that group's view and home form, and expects T01 to follow. |
| **The form `die-register` has "Needs a supervisor's approval" on** (`approval: true`) | `l60` saves a die as Dana and expects it to be *held* (`FP.approvals.list()` has one waiting, the die is not saved) until Josh approves it; with approval off the die saved straight away and the test could not find an Approve button. |

Everything else (the users Josh, Dana Ruiz, Lee Carter and Sam Ortiz with their PINs, site Houston, terminal T01, the dies D-1047 and D-1052, the die forms) is
already in `snap15`.

## Why the first stand-in failed (and why `l59`'s end state is not enough)

1. **`l59` no longer puts T01 back in its group.** The test takes T01 out of the group and then selects "index 1" of the first dropdown in the
   terminal pane to put it back. Since 0.51 that pane's first dropdown is the *on-screen keyboard* setting, so the step now sets the keyboard to "Always" and
   T01 is left on its own, with its own copy of both forms. The group is then empty, so `l78` changed a group that no terminal belonged to, and `l60`
   found `die-setup` on the terminal's own list.
2. **Seeds were stamped with the day they were built; the tests freeze their clock on 18 Nov at 13:00.** When a test changes something the seed
   already set (a group's forms, say), the test's write is stamped *earlier* than the seed's and loses when entries are folded. That is why
   `l76` (which adds a form to the group) failed against a seed made on 23 Nov, even with the right group. The original seeds were made on 18 Nov, so the tests'
   writes were always later.

## The rebuild

- `regress.sh` builds every seed with the page's clock **shifted back to 08:00 on 2026-11-18** and still moving forward (`FP_SEED_OFFSET_MS`, read by
  `dummies/base.js`), so a seed is always older than the tests' own clocks.
- `dummies/mkseed15b.js` starts from `snap15`, puts T01 into "Production presses" with only `die-register`, and turns approval on for `die-register`.
- `l60` and `l78` come off the known-failing list: they pass against the rebuilt seed, as do the other tests that start from it.

## What is still a guess

- The original may have differed in ways no test notices (the group's home form and view, the keyboard setting, or how long ago the entries were made).
  Every test that starts from it passes, which is the only evidence available; it cannot be proven identical.
- The chain and `l59` are the *current* versions of those tests. The original `snap15` was built by an older UI (0.41), so the seed is "the same state
  reached by today's route".

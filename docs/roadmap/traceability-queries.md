# Roadmap: Traceability queries

Status: Proposed (model agreed in principle, not built). Clickable model: `docs/design/trace-model.html`.

## What already exists

- **Trace tree (0.55).** A generic visual that starts from one item (or a list of up to 25) and
  shows what it leads to, branch by branch. Builders define the branches with formulas (the pilot
  has TraceRun, TraceShift, TraceNeed, TraceChecks, TraceRacks over a year of data, and a form
  "Trace a rack" on the QC office). Limits: 6 levels, 400 items.
- **Carried values (0.50).** A run's shift, line, profile, part, customer and colour are copied onto
  each rack it makes.
- **Partial racks.** A rack that finishes a partial rack notes it and its pieces, so a run can be
  linked to a later run.
- **Hourly checks** per run, with pass and fail.
- **One value to every item of a list** (0.37) and **supervisor approval** (0.41), which a hold
  can use as they are.
- **As-of reads.** Entries are never edited, so any answer can be worked out as it stood earlier.

## What a QC person cannot do today

1. **Start from a symptom.** The tree needs a known item. A complaint usually gives a rack ID, a
   customer plus a date, a failed check, or a material lot.
2. **Decide how far the problem reaches.** The tree shows relations, not a scope. Nobody can say
   "everything made between the last good check and the next good one" and see the count.
3. **Act on the result.** The tree can't put racks on hold, export a list, or say where each rack
   is now.
4. **See what could not be linked.** A branch that can't be worked out shows a message, but the
   user is never told how complete the answer is.
5. **Keep the answer.** A trace is not recorded, so there is nothing to compare later.

## How it works for the user

1. **Start from.** Rack ID, complaint (customer, profile, date range), a failed check, or a
   material lot. The platform shows the chain it found (rack, run, shift, crew, shipment) and
   suggests the **bad point**, for example the first failed hourly check on that run. The user can
   change it.
2. **Choose how far it reaches.** Three scopes, each with a live count before it is chosen:
   - **Suspect window:** racks made between the last passing check and the next passing check.
   - **Whole run:** every rack on the run, plus a partial rack carried to a later run.
   - **Same material lot:** adds other runs that used the lot (needs the lot recorded at Start
     shift).
3. **See what is affected.** A summary (racks, pieces, shipped, in stock, on hold) and three views of
   the same set: **Timeline** (checks and racks along the run, with the suspect window shaded),
   **List** (grouped by where each rack is now, with checkboxes) and **Tree** (the existing trace
   tree, unchanged).
4. **Act.** Place the selected in-stock racks on hold with a reason and a supervisor PIN. Export the
   list. Save the trace as a case (Cases kind) holding the start point, scope, counts and the time
   it was run. Running it again later gives a dated second answer.
5. **Read the gaps.** A short panel says how many racks were linked, how far back the search
   looked, and what could not be known (for example racks shipped without using the Ship form).

## Rules of the query

- **Suspect window.** From the last item before the bad point where the test passes, to the next
  item after it where the test passes. Written as a library function in the formula language,
  for example `SuspectWindow(checks, bad, good)`. If there is no later passing check, the window
  runs to the end of the run and says so.
- **Scopes only grow.** Window is inside Run, which is inside Lot, so counts never shrink when
  widening.
- **Shipped racks can't be held.** They are counted and listed, and flagged as needing a customer
  notice. Sending the notice waits for the dispatcher (email hooks), which is not built.
- **Nothing is hidden.** A trace over a cap (400 items) says "showing 400 of N" and asks for a
  narrower scope. It never silently truncates.
- **Holds are entries.** Placing on hold saves `rack.hold` (with the reason and the person) to each
  rack, so history shows who held what and why. Releasing is another entry.
- **Who may do what.** Anyone who can open the form may trace. Placing on hold needs a supervisor
  (the existing approval rule).

## Proposed build steps

Numbered as proposals; they will take the next free step numbers in the spec.

| Step | What | Size | Done when |
| --- | --- | --- | --- |
| T1 | **Reverse links.** Find "everything that points at this item" (racks that name a run, runs that name a partial rack). References are never followed automatically today, so this needs a lookup that scans the live window and the year-back files. Measure it first on a year of pilot data. | L | A lookup returns the racks of a run and the runs that finished a partial rack, within an agreed time on a typical terminal. |
| T2 | **Start-from step.** A generic Find control: search one structure by values and date range, or by a reference, and hand the result to the tree as its top. | M | The four start points above work on the pilot structures. |
| T3 | **SuspectWindow function** and the bad-point suggestion (first failing check). | S | Unit tests cover no failing check, a failing check at the start or end of a run, and two failures. |
| T4 | **Scope control.** Chips with live counts, driven by formulas the builder writes once per trace (window, run, lot). | M | Counts update without leaving the screen and match the list. |
| T5 | **Containment list and Timeline views.** Flattened list with where-now, grouped, selectable, with totals; a timeline visual for a series of checks and items. | L | List and timeline show the same set as the tree for the pilot data. |
| T6 | **Place on hold.** A button that saves one hold entry to every selected item with a reason and supervisor approval, and a release action. | M | Holds appear on every terminal and in the weekly tables, and are fully in history. |
| T7 | **Save the trace as a case,** and run again as-of. | M | Re-running shows a dated second result and what changed. |
| T8 | **Gaps panel.** Count of linked and unlinked items, how far back it looked, and known blind spots. | S | Every trace shows it. |
| T9 | **Customer notice for shipped racks.** Needs the email dispatcher. | Later | Out of scope until the dispatcher exists. |

## Risks and open questions

- **Speed of reverse links (T1) is the main risk.** The data is append-only daily files, and the
  live window is 60 days. A year-back trace may be slow. A small derived index built by the weekly
  batch is the fallback. Measure before committing to the rest.
- **Is the raw material lot recorded?** The lot scope depends on it. If not, add a lot field to Start
  shift first, or drop that scope for now.
- **Where does "shipped" come from?** The pilot rack form uses the ERP rack ID, so shipping may live
  only in the ERP. If so, "where now" is only as good as a Ship form, or the platform needs a read
  from the ERP (this is an existing open question: does any data need to reach the ERP).
- **What counts as the bad point for other streams** (returns, holding)? The first version assumes
  an hourly check series. Other streams may need a different series or a manual bad point.
- **Who may start a trace** and who may place holds, per site.
- **Per-site scope.** Sites share structures, so a trace crosses sites unless limited. Should it?

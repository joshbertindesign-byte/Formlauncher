# Retiring definitions (0.65.0)

Built from `docs/roadmap/retiring-definitions.md`. Forms, structures and functions (lookups are functions) can now be **retired and never deleted**; retiring
publishes a new version with retired status, so history, as-of reads and Restore work as before.

## What a builder can do

| Where | What |
|---|---|
| Editor, a form, structure or function | **Retire** (publishers). A dialog shows what still uses it, by name, each with its fix, and Retire stays disabled until nothing active uses it. When it is free it offers **Also retire what only this uses** (a checklist, nothing ticked), for a form **Replaced by** (optional), and a note. |
| Editor, a retired definition | A banner (who, when, note, "Replaced by X"); read-only; **Reinstate** is for **admins only** (it runs the normal publish checks, so a dependency that is still retired blocks it and says which). |
| Editor, a form | **Duplicate as new form**: new id, title, and for each structure and function **Share** (default; one item never lives in two structures) or **Copy**. |
| Editor, map | A collapsed **Retired · N** shelf per branch (Forms, Data, Formulas), dimmed rows, forms show "replaced by X". Retired definitions no longer sit in the live lists. |
| Editor, Find and every picker | Skip retired definitions unless **Show retired** is ticked (remembered on the terminal, `fpe-show-retired`). A retired definition that is already referenced is always shown, suffixed "(retired)", with a problem line. |
| Editor, creating or renaming | A non-blocking warning if a retired or active definition has the same name. |
| Launcher | A retired form is off the home screens and tile lists. Opening one by URL or shortcut **redirects** to its replacement (if this terminal may open it) with a one-line "X was replaced by Y", otherwise shows a plain "retired" card with a way back. Pinned and trial launchers of a retired form show the card. Records already saved with it still view and print. |
| Admin > Launchers | A shortcut to a retired form is flagged; one tap **points it at the replacement**. |
| Admin > Clean-up | **Unused finder**: definitions nothing active uses (forms on no terminal and opened by no form, structures nothing writes to or reads, functions nothing calls), each with a Retire button and "retire all shown". |

## Rules the platform enforces

- **A retired structure takes no new entries** ("X is retired: it takes no new entries"), but its data, history, as-of reads, lookups and records stay readable.
- **Ids are never reused.** A new definition cannot take a retired definition's id (case-insensitive); the message says to reinstate it or pick another. A display name can be reused (warned).
- **Nothing new can use a retired definition**: publishing a form that opens a retired form, saves to or reads a retired structure, or calls a retired function is refused, naming it. Already-published uses keep working for functions and lookups.
- **Retiring is refused while an active definition depends on it**, naming every dependent and the fix. There is no "retire anyway" in the editor.
- **Superseded-by** must be a published, active, different form, and cannot make a loop.
- **Roles:** publishers retire; admins reinstate. There is no per-site retirement (narrow a form's `sites` instead); retiring is global.

## Decisions made (change any)

1. A retired structure stays registered **read-only** so history keeps working; `FP.structures.has()`/`list()` leave it out, `get()` returns it with `retired: true`.
2. **Show retired** is one preference per terminal (`fpe-show-retired`) read by the map, Find and the form editor's pickers; each picker also has its own small checkbox, shown only when something of that kind is retired.
3. Retired shelves appear **only when their count is above zero**.
4. The **Unused finder** treats a form as used if it is `launchable`, is a `home` form, or a launcher shortcut names it. `FP.defs.unused()` is asynchronous (it reads groups and terminals from the data folder).
5. **Reinstating also covers restoring** over a retired definition: publishing over a retired definition is an admin action (the intended route is Reinstate).
6. A copied function is named `<name>_copy` (function names cannot contain a dash). In a duplicated form, formula references to a copied function are renamed only where written as `Name(` with no space.
7. **On a shared (supervisors-only) terminal** a retired form gets the "retired" card even when it has a replacement, if the replacement is not on that terminal's form list (the usual `mayOpen` rule).

## Not built / still open

- **Containers** (values inside a structure) cannot be retired yet; the roadmap lists them but the model has no definition of its own for one. A separate order.
- **Power BI "retired" column** is an external flow; the definition's retired status is what it should read. Nothing to build in this repo.
- **Formula chips** in the formula box offer only active functions and have no Show retired option.
- **No test** yet for a retired button or sub-form target on a screen that is already open (the existing "missing" handling is used).
- **Roadmap question left open and answered by building both**: Duplicate (reuse) and the Declutter set (the shelf, Find and the Unused finder).

## Tests

`l170` to `l172` (the definitions layer), `l173` to `l175` (editor), `l176` and `l177` (pickers), `l178` and `l179` (launcher and Admin). The screenshot harness now has 13 screens
(adds Find, the Retire dialog and a retired form) with day and night baselines; contrast is **0 of 1,138 text elements** below the minimum in both modes.

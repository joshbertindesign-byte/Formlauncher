# Roadmap: Retiring definitions

Status: Agreed (design decided, not built). Proposed as a build step after the current editor work.

## Problem

Forms and structures can't be retired. As definitions are replaced or changed, the map, pickers and
Forms list fill with things nobody uses, and reusing a form becomes cumbersome.

## Rule

Definitions are retired, never deleted, the same as items. Retiring publishes a new version of the
definition with status `retired`, so history, as-of reads and "restore" work as they do now.
Applies to forms, structures, functions, lookups and containers.

## What retired means

- **Forms**
  - Leave terminal home screens and the Forms branch of the map.
  - Can't be opened as a sub-form or a button target.
  - The launcher file shows a "retired" notice instead of breaking.
  - Saved records still view and print with the version that wrote them.
  - Pinned or trial launchers of a retired form stop launching.
- **Structures**
  - Stop accepting new entries.
  - Data, old entries and reporting are kept (see Reporting).
  - The structure ID and storage folder are never reused. The display name can be reused, with a
    duplicate-name warning.
- **Functions, lookups, containers**
  - Hidden from pickers; existing uses keep working.
- **Reinstating** publishes a new active version.

## Roles (decided)

- Publishers can retire.
- Admins can reinstate.

## Reporting (decided)

Retired structures stay in the weekly Power BI tables and in every exception report, flagged with a
`retired` column. Retiring must never change or drop history, because history is needed for audit.

## Sites (decided)

No per-site retirement. Forms are already instanced per site through their `sites` setting, so a
form no longer needed at one site is handled by publishing it with a narrower `sites` list.
Retiring is global.

## Publish checks

Retiring is refused while an active definition depends on it. The refusal names each dependent and
the fix, like other publish checks. The map's "used by" reach already computes this.

- A form can't be retired while an active form opens it.
- A structure can't be retired while an active form writes to it, or an active lookup or function
  reads it.
- **Retire with what only it uses:** a preview listing structures, functions and containers used
  only by this form, so they can be retired together. Shared definitions stay active.

## Declutter

- Map: a collapsed Retired shelf per branch (Forms, Data, Formulas) with a count.
- Find and every picker (structure, function, container, sub-form) skip retired definitions unless
  "Show retired" is ticked.
- Admin > Clean-up gets an **Unused finder**: definitions nothing active uses (forms on no terminal,
  structures no form writes to), each retirable in one tap.

## Reuse

- **Duplicate as new form:** copies the form under a new ID. For each dependency, choose to share it
  (the default for structures, since one item never lives in two structures) or copy it.
- **Superseded by:** retiring a form can name its replacement. The launcher redirects to it and the
  map shows the lineage. Mirrors the `superseded` status media already has.

## Suggested build order

1. Retired status, publish checks and the dependency report.
2. Map shelf and picker hiding.
3. Launcher and home-screen behaviour.
4. Duplicate and superseded-by.
5. The Unused finder.

## Still open

- Whether "reusing a form" means starting a new form from an existing one (Duplicate) or finding the
  right existing form among clutter (Declutter). The design covers both; this only affects priority.
- Whether a retired structure's display name should be reserved or just warned on when reused.

# Roadmap: Retiring terminals and sites

Status: **Agreed (design decided), not built.** Follows `docs/RETIRING-DEFINITIONS.md` (0.65.0), which left containers such as terminals and sites out.
Decided with the owner when F20 was closed: *terminals are what they are; they can be renamed but never changed; retiring one must not lose the record of its past existence.*

## Today

- **Sites** can already be turned off and on (`FP.sites.setActive`, Admin > a site > "Turn this site off"). Nothing is deleted, but the platform only refuses when it is *this* terminal's site.
- **Terminals** can only be **taken off the list** (`FP.identity.forget`), which **deletes the registry file**: the terminal's past existence (its ID, site, when it was last seen, its device) is lost, and its ID can be reused without a word.
- A terminal's site is chosen on that terminal and is not changed from the Admin page (F20, decided: correct the spec, no control).

## What changes

| Thing | Rule |
|---|---|
| Retire a terminal | Admin only. The registry file is **kept**, marked `retired: { at, by, note }`. The terminal leaves its group, the Admin lists and the pickers; its past entries keep naming it. Nothing is deleted. |
| Reinstate a terminal | Admin only. Clears the mark. |
| A retired terminal's ID | Never reused: setting up any device with a retired terminal's ID is refused ("T05 was retired on 24 Nov 2026; pick another ID"), not just warned. |
| A retired terminal that is switched on | Its launcher shows one plain card, "This terminal was retired on <date> and shows no forms. An admin can reinstate it from Admin.", and no forms, sign-in or saves. Check-in keeps the mark and does not clear it. |
| Retire a site | Admin only (as today), but **refused while an active (not retired) terminal or group is at it**, naming each with what to do. A retired site takes no new terminals (as today) and is greyed in pickers. |
| Admin lists | Retired terminals and sites sit in a collapsed **Retired · N** shelf, dimmed, with who, when and a Reinstate button. Shown only when the count is above zero. |
| "Take it off the list" | Replaced by **Retire this terminal**. `FP.identity.forget` stays in the API for tests and repairs but the Admin page no longer offers it. |
| Renaming | Unchanged: terminals and sites can be renamed. Nothing moves a terminal to another site from Admin. |
| History and reports | Unchanged: entries keep the terminal ID and site they were made under. |

## Build order

1. `fp-identity.js`: `retire(id, note)`, `reinstate(id)`, `isRetired(entry)`; `checkIn` keeps `retired`; `assign` and `conflict` refuse a retired ID; `all()` unchanged (callers filter).
2. The retired-terminal card at start-up (`FP.identity.run`, launcher).
3. `fp-sites.js`: retire refused while active terminals or groups are at the site; reinstate; wording "Retire / Reinstate" (the API names `retire`/`reinstate` are already the entry names).
4. Admin: the terminal pane's button and the **Retired · N** shelf for terminals and for sites; the group editor's terminal picker skips retired terminals.
5. Tests, Help ("What changed"), `docs/GUIDE-UPDATES.md`, the Spec and Guide docs.

## Not in scope

- Moving a terminal to another site (decided: never).
- Retiring users (already exists as active/retire in Admin > People) and media entries.
- Per-terminal retirement of a single form (retire the form, or narrow its `sites`).

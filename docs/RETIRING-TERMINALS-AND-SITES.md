# Retiring terminals and sites (0.67.0)

Built from `docs/roadmap/retiring-terminals-and-sites.md`. Terminals and sites can be **retired and never deleted**; a retired terminal's past existence is kept.
Decided with the owner (F20): a terminal is never moved to another site from Admin; terminals and sites can be renamed.

## What an admin can do

| Where | What |
|---|---|
| Admin, a terminal | **Retire this terminal** (admin only, not the terminal you are on). The registry record is kept and marked with who, when and an optional note. The terminal leaves its group. The old "Take it off the list" (which deleted the record) is gone from the page. |
| Admin, a retired terminal | Read-only card showing who, when and the note, with **Reinstate this terminal** (admin only). |
| Admin, a site | **Retire this site** / **Reinstate this site**. Retiring is refused while an active terminal or an active group is at the site, naming each and what to do. A retired site takes no new terminals. |
| Map | A collapsed **Retired · N** shelf under Plant (only when N is above zero) for retired terminals and retired sites: dimmed rows, who and when, and a **Reinstate** button for admins. |
| Pickers | Retired terminals are skipped in the group editor, the centre and duty pickers, the rehearsal picker and the screen-size survey. |

## Rules the platform enforces

- **A retired terminal's ID is never reused.** Setting up any device with it is refused: "T05 was retired on 24 Nov 2026; pick another ID."
- **A retired terminal that is switched on** shows one card ("T05 is retired", what happened, "An admin can reinstate it from Admin") with a **Check again** button. No forms, no sign-in, no saves.
- **Check-in never clears the mark.** `FP.identity.checkIn` keeps `retired`, and stops if the registry read fails rather than rewriting the file blind.
- **Past entries are untouched** and keep the terminal ID and site they were made under. The mark is by terminal ID, not by device key.
- **Roles:** admins retire and reinstate. `FP.identity.forget` stays in the API (tests, repairs) but the Admin page does not offer it.
- Sites that only definitions name stay retirable; the site card lists those definitions as information.

## Decisions made on the way (change any)

1. A retired terminal's launcher offers **Check again**, so it does not need a manual reload after an admin reinstates it.
2. Retiring a site is blocked by an active group even when every terminal in it is already retired.
3. The date on the card is written "24 Nov 2026".

## Not built / still open

- **Other containers** (values inside a structure) still cannot be retired.
- **Per-terminal retirement of a form** is not a thing: retire the form or narrow its `sites`.
- **Help**: "What changed" has a 0.67 entry. The Spec and Guide wording is in `docs/GUIDE-UPDATES.md`.

## Tests

`l180` (identity layer), `l181` (sites), `l182` (the Admin screens and the retired-terminal card).

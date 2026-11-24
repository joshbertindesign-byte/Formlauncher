# Text to add to the User Guide and the Architecture Spec

The two PDFs in `Forms b/` can't be edited from this repo, so here is the wording to add when you next revise them. It covers 0.64 to 0.66. Section
names are suggestions.

## Glossary (new terms)

- **Night mode:** a darker look of every screen, chosen per terminal with the Night / Day button in the header. It is saved on that terminal and does not follow the person.
  Printing always uses the day look.
- **Retired:** a form, structure, function or lookup taken out of use without deleting it. Retired things leave the terminals and the pickers, keep their history, and can be
  reinstated by an admin. A retired structure takes no new entries; its records stay readable.
- **Replaced by:** the form that takes over from a retired form; opening the old one goes to the new one.
- **Kind colour:** the colour that shows the kind of data a form makes: Runs green, Inventory amber, Records blue, Cases red, Orders violet, Lists grey.
- **Tile:** the small shape holding a glyph: a rounded square for a form, a hexagon for a structure, a circle for a function.

## User Guide: Terminals and screens

- *Night and day.* Tap **Night** in the header to switch a terminal to the dark look and **Day** to switch back. The choice stays on that terminal. A terminal that can't save its
  preferences starts in Day.
- *Saving.* After a save the screen says what was saved, for example "Saved · Rack R-1042". If something can't be saved it says why and what to do.
- *Touch.* Buttons and fields on the terminals are at least 48 px, the Save button 56 px and entered text 17 px.

## User Guide: The editor

- *Reading the map.* Colour shows the kind of data; the shape shows the kind of thing (see Glossary). A form is coloured by the record it mainly makes.
- *Reading a form's fields.* A filled tile writes data; a dashed tile only shows it. The chip at the right says which structure it writes to (arrow down) or reads from (eye).
- *Checks.* A field row is quiet when it is right and speaks (red, with the fix) only when something is wrong. **Show all checks** shows a tick on every row that passes.
- *Retiring.* In a form, structure or function pane choose **Retire**. The dialog lists what still uses it and how to fix that; when nothing does, you can retire what only it uses
  at the same time and name the form that replaces it. Admins can **Reinstate**. **Show retired** (above Find) lists retired things in Find and in the pickers.
- *Duplicate as new form.* Copies a form under a new id; for each structure and function choose Share (usual) or Copy.
- *Unused finder.* Admin > Clean-up lists forms, structures and formulas nothing active uses, each with a Retire button.

## Architecture Spec

- **Storage and entries:** unchanged.
- **Definitions (Library):** a definition's `retired` status is a new version, never a deletion; `supersededBy` (forms) is stored on the retired version. Retiring is global (no per-site
  retirement; narrow `sites` instead). Publishers retire; admins reinstate.
- **Structures:** a retired structure refuses new entries ("X is retired: it takes no new entries") but is registered read-only so history, as-of reads and lookups keep working; its id and
  storage folder are never reused. Reports keep retired structures, flagged `retired`.
- **Runtime and releases:** new modules `fp-theme.js` (tokens, `FP.theme`), `fp-fonts.js` (Inter, embedded), `fp-icons.js` (glyphs, tile and chip) load right after `fp-config`.
  No colour is written in code outside `fp-theme.js`. The release is checked by `dev/tools/release.py` (no `eval`, a counted number of HTML-from-string assignments).
- **Look:** UI semantic palette (`--bg --surface --line --fg --muted --accent --head`, the six kind colours), day, night and print values; the screens never name a colour.
- **Build plan:** steps 17, 20 and 27 are no longer "Built, testing"; script (0.57), library (0.48), sessions (0.36) and the old media library (0.42) are removed; see `docs/FIX-LIST.md` for the full list of text that no longer matches the code.

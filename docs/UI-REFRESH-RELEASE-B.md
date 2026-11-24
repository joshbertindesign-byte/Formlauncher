# UI refresh, Release B (0.66.0): the new look

Steps 7 to 11 of `docs/roadmap/ui-refresh-and-night-mode.md`, on top of Release A (night mode and the colour foundation, 0.64.0) and retiring definitions (0.65.0).
There is no Classic look and no opt-in: this replaces the old look.

## The idea, as built

**Colour shows the kind of data; shape shows the kind of thing; text is left for names.**

| Shows | How |
|---|---|
| Kind of data | Six colours from the structure kinds: **Runs** green, **Inventory** amber, **Records** blue, **Cases** red, **Orders** violet, **Lists** grey. A form takes the colour of the record it mainly makes. Boards and reports that save nothing stay neutral. |
| Kind of thing | Form = rounded square, structure = hexagon, function = circle, site and terminal = small neutral tiles with a pin or a screen. Colour is never the only signal: each has a glyph too. |
| Field family | A **filled** tile writes data; a **dashed** tile only shows it (or is worked out). An arrow chip says where: down-arrow plus the structure's name = writes there, eye = reads from. A ghost **ƒ** chip = worked out. |
| Quiet when right | A field row speaks only when something is wrong (red, with the fix underneath). The green ticks are gone; **Show all checks** brings them back. |

## What changed on each screen

- **Editor:** header bar with glyph pills; the map with tiles and kind chips, the selected row highlighted; field rows as above; the preview bar as segmented controls (Edit | Try it, Fit | 100%); a "Field settings" panel with a summary row, a hexagon "Saves to" row, switches for yes/no settings and Width as S, M, L, Full. Every existing setting is still reachable. Structure and function editors, dialogs and history use the same language.
- **Operator screens (launcher, forms):** form cards (16 px corners, a tile with the form's colour and glyph, the name at 17 px, a muted "Saves to Racks" line); a form opens with a head tinted by its kind and a Home back control; labels 15 px, inputs 52 px with 17 px entered text; choice buttons turn to the kind's colour with a tick when selected; the number stepper has 56 px buttons and a 34 px value; the on-screen number pad keys are 56 px; a sticky Save bar with a 56 px Save button; and the confirmation now **names what was saved** ("Saved · Rack R-1042"; "Sent for approval · ..."; "Not saved: ..." with the plain reason). A form whose author wrote their own saved message keeps it. Set-up and sign-in cards use the same language with 56 px PIN keys. Empty states and errors were reworded to one plain sentence with the next step.
- **Admin and Help:** all ten Admin panes (tabs as a segmented control, rows with tiles and chips, problems in red with the fix, tables with a quiet header and 40 px+ rows), the media library, the Unused finder; Help with a chapter panel, mono name chips and a clearer heading scale; the dashboard and visual tiles as cards with tone chips that carry a glyph.
- **Help "What changed":** a new chapter in plain language for 0.64, 0.65 and 0.66, with who each change affects.

## Measured

- **Touch targets (operator screens):** interactive elements under 48 px, before and after: line terminal 5 of 11 to **0**; a form 8 of 12 to **0**; QC office 6 of 16 to **0**; Add a need 4 of 28 to **0**.
- **Contrast:** **0 of 1,113** text elements below 4.5:1 (3:1 for large text and symbols) in day and in night, on all 13 screens; plus every Admin pane, seven Help chapters, and the new dialogs, in both modes.
- **Print:** a saved record prints identically before and after (0.000%) in day and night; print always uses day colours. A leak found on the way (the dark first-paint background also applied to printed pages) is fixed.
- **Tests:** full regression from nothing, see `docs/TESTING.md`. Two tests clicked the Admin pill by its old text and now click it by class.

## Decisions made on the way (change any)

1. **A form's colour comes from "the record it makes"**: the first source whose item ID the form enters or makes and that is not just carrying values on (`carry`), else the first source it writes to. So Rack is Inventory (racks), Start shift is Runs (shifts), Changeover is Inventory (the partial rack it leaves). Derived only: no new form setting, so the script notation and control catalog are unchanged. The explicit setting is listed under Later.
2. **The warm palette is real values, not a recolour of the old ramps**: semantic names (`--bg`, `--surface`, `--accent`, `--head`, the kinds) have the mockup's exact day and night values, and the old neutral surfaces and lines were warmed to match so unrestyled corners don't clash.
3. **Quiet checks apply to every row** (fields, structure values, functions), not only fields, and the per-tab problem counts are unchanged.
4. **The screen-size picker in the preview stays a select**, because it lists terminals and tests rely on it.
5. **The "Saves to" row in the settings panel repeats the existing Saves to select**, since every existing setting was kept.
6. **While a form is open, the page title is visually hidden** (the tinted head carries it) but kept for screen readers and tests.

## Not done / still open

- The mockup's **status strip** on the operator home (running since, racks made, next check due): out of scope in the plan; it belongs with the dashboard and dispatcher work.
- The **Stress test** pane is drawn by `fp-stress.js`, so only its frame and generic buttons changed.
- The "Running lines" heading on the home board comes from a visual and is bold, not uppercase. The "No line is running" wording lives in the Test pack's definitions.
- **User Guide and Spec PDFs** can't be edited from the repo: the wording to add is in `docs/GUIDE-UPDATES.md`.

## To check on a real terminal

- 48 to 56 px targets and the 56 px Save, **with gloves**; 17 px entered text at arm's length.
- Night and day on the real floor (bright and dim areas), and the sticky Save bar on the smallest terminal screen (does it cover the last field?).
- Printing a record on paper, day and night.

## Later (from the plan)

Explicit icon and tone settings on a form; the status strip; a kiosk and wall-display mode; bilingual labels; an Auto mode for Day/Night.

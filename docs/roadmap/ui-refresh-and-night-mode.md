# Engineering order: UI refresh and day/night mode

Status: Agreed direction (design decided, not built). Reference mockup: `docs/design/ui-mockup.html`
(Editor, Operator and Key tabs; light and dark).

## Goal

Make the platform feel approachable to the people who fill in forms, without losing the density
builders need. Colour marks the kind of data, shape marks the kind of thing, and text is left for
names. Every screen works in day and night mode.

## Design rules (from the mockup)

1. **Colour means a kind of data.** Six kinds, from the structure kinds the platform already has:
   Runs (green), Inventory (amber), Records (blue), Cases (red), Orders (violet), Lists (grey).
   A form takes the colour of the structure it mainly saves to.
2. **Shape means a kind of thing.** Form = rounded square, structure = hexagon, function = circle,
   terminal and site = neutral. Colour is never the only signal.
3. **Fields show their family.** Filled tile = writes data, dashed tile = only shows data, plus a
   glyph for the control and an arrow chip for the structure it writes to or reads from.
4. **Quiet when right.** A row speaks only when something is wrong (red, with the fix underneath).
5. **Warm, not soft.** Slightly warm neutrals, high contrast, modest corners, no gradients,
   illustrations or pastels.
6. **Floor sizes.** Operator targets 48 to 56 px, entered text 17 px, plain words. Structure,
   container and entry stay in the editor.

## Current state (what the order has to work around)

- Styles are CSS strings inside the runtime files. About 900 hard-coded hex colours across the
  runtime files, 178 distinct. The most: `fp-form-editor.js` (236), `fp-editor.js` (216),
  `fp-forms.js` (116), `fp-admin.js` (106), `fp-launcher.js` (102), `fp-controls.js` (55),
  `fp-visuals.js` (43), `fp-map.js` (39).
- `fp-forms.js` already uses CSS variables (56 uses). `fp-launcher.js` uses none. The editor files
  use a handful. There is no dark mode and no shared theme file.
- Releases are file lists in `release.json` (`load.launcher`, `load.editor`) installed as zips.
  A new file means adding it to both lists. Going back to an older release is already supported.
- UI preferences already live in `localStorage` with try/catch ("best effort"), per terminal.
- Print has its own CSS (`@media print`, `@page`). Charts and some controls set colours from code.
- No third-party libraries and it must work from `file://`, so no CDN fonts or icon sets.

## Steps

Sizes: S = under a day, M = a few days, L = about a week or more. Each release can ship alone and
can be rolled back to the previous one.

| Step | What | Size | Done when |
| --- | --- | --- | --- |
| 1 | **Baseline harness.** A demo data folder (a few structures, forms, runs, users, two sites) checked into the repo, plus a Playwright script that opens the launcher and editor against it and saves a screenshot of each key screen. The File System Access folder picker is replaced in the harness by a seeded in-browser folder (to verify that the platform's folder code accepts it). | M | One command produces a labelled screenshot set for the launcher, editor, form editor, structure editor, Admin, Help and a dashboard. Baseline images are stored. |
| 2 | **Theme file** `fp-theme.js`, loaded right after `fp-config` in both lists. Defines every token once: surfaces, lines, text, accent, header, the six kind colours with tints, good/warn/bad, focus ring, shadow, radius, spacing, type scale, touch sizes. Day values on `:root`, night values under `[data-theme="night"]`. Exposes `FP.theme.get()`, `set(mode)` and `apply()`. | S | Both pages load it; the tokens exist; nothing looks different yet. |
| 3 | **Move colours onto tokens, no visual change.** Map the 178 hex values to about 30 tokens, then replace literals file by file: `fp-forms`, `fp-controls`, `fp-launcher`, `fp-visuals`, `fp-editor`, `fp-form-editor`, `fp-admin`, `fp-help`, `fp-map`, the rest. Include colours set from code (`style.cssText`, `el.style.*`) and the error banner in `launcher.html` and `editor.html`. A colour with no matching token is listed and decided, not guessed. | L | Day-mode screenshots match the step 1 baseline within tolerance. A script finds no remaining hex literals outside the theme file and the documented exceptions. |
| 4 | **Night mode.** Night palette, native controls via `color-scheme`, scrollbars, date picker, focus ring. A contrast check script enforces at least 4.5:1 for text and 3:1 for icons and borders in both modes. Print always uses day values. | M | Every baseline screen renders in night mode with no unreadable text, and the contrast script passes. A printed record is identical in both modes. |
| 5 | **Switch and persistence.** Day, Night and Auto (follows the system) in the header of the launcher and editor. Saved per terminal in `localStorage`, best effort like other preferences. Applied before first paint so there is no flash. Default Auto. | S | Choice survives reloads and is shared by the launcher and editor on that terminal. A terminal with storage blocked still works in Auto. |
| 6 | **Night-safe content.** Charts and visuals get a palette for each mode (control chart limits, pareto, heatmap, board tiles). The drawing pad keeps a white writing surface so saved signatures and sketches stay legible whatever the mode. Photos, PDFs and media thumbnails are not recoloured. Audit definitions for colours users set themselves (field colours, choice tints) and map them to tokens or night-safe variants. | M | Every visual and the drawing pad pass review in both modes. User-set colours stay readable in night mode. |
| 7 | **Identity system.** `fp-icons.js` (hand-drawn inline SVG glyph set, about 30 glyphs, no library) and `FP.kinds.look(structure)` returning the tone and glyph for a structure kind. A form's tone comes from the structure it mainly saves to (the one holding its item ID, otherwise its first write source). Derived only; no new form setting in this release, so the script notation and the control catalog are unchanged. | M | The map, field rows and launcher cards all read tone and glyph from one function. A form that writes to several structures picks one by the stated rule. |
| 8 | **Editor restyle.** Map rows with shape tiles and kind chips. Field rows with a glyph tile, family fill, and write/read arrow chip. Checks go silent when right (a Show all checks toggle keeps the old view). The preview shows at real size. Settings panel as in the mockup. | L | The Change a need screen matches the mockup in day and night. Every existing editor action still works. |
| 9 | **Operator launcher restyle.** Home screen of form cards (tone and glyph from step 7), line picker, 48 to 56 px targets, bigger entered text, a clear save confirmation naming what was saved, friendlier empty states and error wording. Choice, number pad and stepper controls restyled. The status strip from the mockup is out of scope here (see Later). | L | The mockup's home and Rack screens are reproduced with real forms. Existing launcher files keep working. |
| 10 | **Admin, Help and printing.** Restyle Admin tables and Help to the same tokens. Confirm print and Save as PDF are unchanged. | M | All screens in the harness set pass in both modes. Prints match the baseline. |
| 11 | **Rollout.** Ship as normal releases (below). Add a "What changed" page to Help. Update the User Guide and spec (new term: Night mode). During the first release the new look is opt-in per terminal (Look: Classic or New in the header menu); the release after makes New the default. | S | The old look can be chosen back on any terminal. Guide and spec updated. |

## Release plan

| Release | Contains | Visible to users |
| --- | --- | --- |
| A | Steps 1 to 3 | No change |
| B | Steps 4 to 6 | Night mode and the switch |
| C | Steps 7 and 8 | New editor look |
| D | Steps 9 and 10 | New operator look (opt-in, then default) |
| E | Step 11 | Default flipped, Classic option removed one release later |

Steps 7 and 8 can start once step 3 is done and do not depend on night mode, so releases B and C
can overlap if there is capacity.

## Risks

- **No UI tests on a large runtime.** The step 1 harness is the safety net. Do not start step 3
  without it.
- **Mechanical edits in big files.** Step 3 touches a lot of lines. Do it one file per commit, with
  a screenshot diff each time.
- **Colours set in code or in saved definitions.** Missed ones show up as light patches in night
  mode. The step 3 script and the step 6 audit are there to catch them.
- **Fonts.** The mockup used Inter from a CDN. The platform cannot. Use the system font stack
  (system-ui, Segoe UI) or ship a font file inside the release folder, and check that it loads from
  `file://`. Decision needed.
- **Dim areas and glare.** Night mode on a bright floor can be worse than day mode. Keep both
  strong in contrast and test on a real terminal screen.

## Decisions

1. **Where the choice is saved.** Recommended: per terminal now (step 5), because a screen's
   lighting belongs to the place. Later, a per-person preference saved as an entry so it follows
   them. Do you want the per-person version in release B?
2. **Auto means what?** Recommended: follow the operating system. Alternative: follow the shift
   (for example night shift uses night mode). The shift version needs the Usual shifts structure.
3. **Font:** system stack, or ship Inter in the release?
4. **Classic look:** how long to keep it (recommended: one release after the default flips).

## Later

- Status strip on the operator home (running since, racks made, next check due). It needs values
  the platform can compute, so it belongs with the dashboard controls and the dispatcher work.
- Explicit icon and tone settings on a form, for the cases where the derived tone is wrong. This
  changes form definitions, the control catalog and the script notation, so it is a separate order.
- Kiosk and wall-display mode, which reuses these tokens and the night palette.
- Bilingual labels.

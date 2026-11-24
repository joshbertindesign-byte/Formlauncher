# Engineering order: UI refresh and day/night mode

Status: **Release A (steps 1 to 6) built in 0.64.0**, see `docs/UI-REFRESH-RELEASE-A.md`. Release B (steps 7 to 11) built in 0.66.0, see `docs/UI-REFRESH-RELEASE-B.md`. Original status: Agreed direction (design decided). Reference mockup: `docs/design/ui-mockup.html`
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
| 2 | **Theme file** `fp-theme.js`, loaded right after `fp-config` in both lists. Defines every token once: surfaces, lines, text, accent, header, the six kind colours with tints, good/warn/bad, focus ring, shadow, radius, spacing, type scale, touch sizes. Day values on `:root`, night values under `[data-theme="night"]`. Exposes `FP.theme.get()`, `set(mode)` and `apply()`. Also ships Inter (see Font below) with `@font-face` rules pointing into the release folder. | S | Both pages load it; the tokens exist; Inter loads from `file://` on a real terminal; nothing else looks different yet. |
| 3 | **Move colours onto tokens, no visual change.** Map the 178 hex values to about 30 tokens, then replace literals file by file: `fp-forms`, `fp-controls`, `fp-launcher`, `fp-visuals`, `fp-editor`, `fp-form-editor`, `fp-admin`, `fp-help`, `fp-map`, the rest. Include colours set from code (`style.cssText`, `el.style.*`) and the error banner in `launcher.html` and `editor.html`. A colour with no matching token is listed and decided, not guessed. | L | Day-mode screenshots match the step 1 baseline within tolerance. A script finds no remaining hex literals outside the theme file and the documented exceptions. |
| 4 | **Night mode.** Night palette, native controls via `color-scheme`, scrollbars, date picker, focus ring. A contrast check script enforces at least 4.5:1 for text and 3:1 for icons and borders in both modes. Print always uses day values. | M | Every baseline screen renders in night mode with no unreadable text, and the contrast script passes. A printed record is identical in both modes. |
| 5 | **Switch and persistence.** A Day / Night switch in the header of the launcher and editor. Saved per terminal in `localStorage`, best effort like other preferences. Applied before first paint so there is no flash. Default Day. | S | Choice survives reloads and is shared by the launcher and editor on that terminal. A terminal with storage blocked still works in Day. |
| 6 | **Night-safe content.** Charts and visuals get a palette for each mode (control chart limits, pareto, heatmap, board tiles). The drawing pad keeps a white writing surface so saved signatures and sketches stay legible whatever the mode. Photos, PDFs and media thumbnails are not recoloured. Audit definitions for colours users set themselves (field colours, choice tints) and map them to tokens or night-safe variants. | M | Every visual and the drawing pad pass review in both modes. User-set colours stay readable in night mode. |
| 7 | **Identity system.** `fp-icons.js` (hand-drawn inline SVG glyph set, about 30 glyphs, no library) and `FP.kinds.look(structure)` returning the tone and glyph for a structure kind. A form's tone comes from the structure it mainly saves to (the one holding its item ID, otherwise its first write source). Derived only; no new form setting in this release, so the script notation and the control catalog are unchanged. | M | The map, field rows and launcher cards all read tone and glyph from one function. A form that writes to several structures picks one by the stated rule. |
| 8 | **Editor restyle.** Map rows with shape tiles and kind chips. Field rows with a glyph tile, family fill, and write/read arrow chip. Checks go silent when right (a Show all checks toggle keeps the old view). The preview shows at real size. Settings panel as in the mockup. | L | The Change a need screen matches the mockup in day and night. Every existing editor action still works. |
| 9 | **Operator launcher restyle.** Home screen of form cards (tone and glyph from step 7), line picker, 48 to 56 px targets, bigger entered text, a clear save confirmation naming what was saved, friendlier empty states and error wording. Choice, number pad and stepper controls restyled. The status strip from the mockup is out of scope here (see Later). | L | The mockup's home and Rack screens are reproduced with real forms. Existing launcher files keep working. |
| 10 | **Admin, Help and printing.** Restyle Admin tables and Help to the same tokens. Confirm print and Save as PDF are unchanged. | M | All screens in the harness set pass in both modes. Prints match the baseline. |
| 11 | **Rollout.** Ship as normal releases (below). Add a "What changed" page to Help. Update the User Guide and spec (new term: Night mode). There is no Classic look and no opt-in: the platform is in test with no users, so the new look replaces the old one directly. | S | Guide and spec updated. |

## Release plan

There are no users yet, so there is no staged rollout. Two releases, each tested on a real terminal
before the next starts.

| Release | Contains | What changes |
| --- | --- | --- |
| A | Steps 1 to 6 | Theme file, Inter, tokens, night mode and the switch. Day mode looks the same as today apart from the font. |
| B | Steps 7 to 11 | New look for the editor, operator screens, Admin and Help |

Steps 7 and 8 can start once step 3 is done and do not depend on night mode, so the two releases can
overlap if there is capacity. The old release stays installed, so going back is still one step.

## Risks

- **No UI tests on a large runtime.** The step 1 harness is the safety net. Do not start step 3
  without it.
- **Mechanical edits in big files.** Step 3 touches a lot of lines. Do it one file per commit, with
  a screenshot diff each time.
- **Colours set in code or in saved definitions.** Missed ones show up as light patches in night
  mode. The step 3 script and the step 6 audit are there to catch them.
- **Font.** Inter ships inside the release folder (decided). Use a Latin subset in WOFF2, regular
  to bold, to keep the release small; include its licence file (SIL Open Font License). The
  fallback stack is `system-ui, "Segoe UI", sans-serif`, so a font that fails to load still reads
  fine. Check on a real terminal that it loads from `file://`. IDs and code keep Consolas.
- **Dim areas and glare.** Night mode on a bright floor can be worse than day mode. Keep both
  strong in contrast and test on a real terminal screen.

## Decisions (settled 2026-11-23)

1. **Day or night is chosen per terminal**, saved on that terminal. A screen's lighting belongs to
   the place, not the person.
2. **Day and Night only.** No Auto option for now. (Auto would have followed the computer's own
   light or dark setting, or the shift. It can be added later as a third choice if wanted.)
3. **Inter ships in the release.**
4. **No Classic look and no opt-in.** The platform is in test with no users, so the new look
   replaces the old one as soon as it is built.

## Later

- Status strip on the operator home (running since, racks made, next check due). It needs values
  the platform can compute, so it belongs with the dashboard controls and the dispatcher work.
- Explicit icon and tone settings on a form, for the cases where the derived tone is wrong. This
  changes form definitions, the control catalog and the script notation, so it is a separate order.
- Kiosk and wall-display mode, which reuses these tokens and the night palette.
- Bilingual labels.
- An Auto mode (follow the computer's light or dark setting, or the shift), and a per-person
  choice saved as an entry so it follows them to any terminal.

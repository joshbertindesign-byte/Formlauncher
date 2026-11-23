# UI refresh, Release A (0.64.0): night mode and the colour foundation

This is steps 1 to 6 of `docs/roadmap/ui-refresh-and-night-mode.md`. **Day mode looks the same as 0.63.1** apart from the typeface (Inter) and a new
Night button in the header. Release B (steps 7 to 11, the new look) is next.

## What you can do now

- Tap **Night** in the header of the launcher or the editor. It becomes **Day**. The choice is saved **on that terminal** (the lighting belongs to the
  place), applies to the launcher and the editor together, and is applied before the page paints, so there is no white flash. A terminal that blocks storage
  still works, in Day.
- Printing and Save as PDF always use day colours. The drawing pad is a white surface with a dark pen in both modes, so signatures saved at night are legible.

## What was built

| Step | What | Result |
|---|---|---|
| 1 | Screenshot harness `dev/shots/shots.js` + `compare.js` | 10 key screens against the Test pack's demo data. Two runs match at 0.000%. Baselines for day and night are committed (`baseline/`, `baseline-night/`). |
| 2 | `fp-theme.js` and `fp-fonts.js` | Every size, radius and colour is a token on `:root`; `FP.theme.get/set/token/toggle/onChange`. Inter (Latin 400-700, OFL) is embedded in `fp-fonts.js` (131 KB). Both load right after `fp-config` in every list. 35 font declarations use one `--font-sans`. |
| 3 | Colours onto tokens | **1,081 colour literals in the runtime became 0** outside the theme file. 873 were rewritten mechanically by `dev/tools/tokenize.py` (0.000% pixel change on all 10 screens); 208 in JS tables and drawing code were converted by three agents, one per area, each checking before/after pixels. 155 tokens in all. |
| 4 | Night palette | By rule from the day tokens (`tokenize.py night`), anchored on the mockup's night values. Contrast check built into the harness: **0 of 772 text elements below 4.5:1 (3:1 for large text and symbols) in day and in night**. |
| 5 | The switch and persistence | Button in both headers; `localStorage` `fp-theme`, best effort; early script in every page and in the generated `launch.html`. Test `l160`. |
| 6 | Night-safe content | Chart, gauge, KPI, control chart, Pareto and board palettes follow the mode (checked with real data); the pad and print as above; definitions can only set colours by name (`good`, `warn`, `bad`), which are tokens, so there is nothing free-form to audit. |

## Decisions made on the way (change any of them)

1. **Tokens are named by role, not just colour.** `--s-*` surface, `--t-*` text, `--l-*` line, `--d-*` data (colours in JS tables and drawing code), then family and
   lightness (`--t-n-42` is neutral text at lightness 42). The same white is a surface in about 150 places and button text in 50; night mode treats them oppositely, so
   they are separate tokens with the same day value.
2. **Inter is embedded in a `.js` file**, not shipped as font files in the release folder (the plan's wording). The installer writes only `.js` files from a release
   zip, so a separate font file would never have been installed; embedded, it installs, is hash-checked and rolls back with the release.
3. **Every colour got a token; nothing was approximated visibly.** Colours within a small distance share one; a rare colour with no neighbour within ΔE 8 has its own.
   This is why there are 155 tokens, not "about 30". Release B's restyle is where they get consolidated into the semantic set in the mockup.
4. **Night values are rules** (lightness remapped in Lab, hue kept): light surfaces go dark, dark text goes light, lines dim, tints deepen; **light text stays light** (it sits on
   the dark header and on strong colours) and **strong colours (buttons, bars) stay as they are**.
5. **Contrast check scope:** text and symbols on this screen set. It is a floor, not a design review; it does not judge hierarchy or taste.
6. Documented exceptions in code are marked `theme-exception`: the pre-boot error banner and first-paint dark background (they must work when the theme file did not
   load), and two fallbacks used only when `FP.theme` is absent (a unit-test stub).

## Still to check on a real terminal

- Inter loads from `file://` in Edge on a terminal (the data is embedded, so it should); how it looks at the real size.
- **Night on the real floor:** the plan's own risk: a bright or dim area can make night worse than day. Look at both on a real screen before Release B.
- The Night button's place and wording in the header.
- A printed record in night mode matches one printed in day mode (tested in the browser, not on paper).

## Tools (all in `kernel/dev/`)

```bash
node dev/shots/shots.js out day          # the 10 screens + contrast check (use "night" for night)
node dev/shots/compare.js baseline out 0.05   # report pixels that changed per screen (fails above 0.05%)
python3 dev/tools/tokenize.py check      # colour literals left outside the theme file (should be 0)
python3 dev/tools/tokenize.py lookup '#2a78d6'  # which token a colour became, by role
python3 dev/tools/tokenize.py night      # regenerate the night tokens after changing the rules
```

A new colour in code is a new token: add the colour to a file, run `tokenize.py map` then `theme` then `night`, and use the token. `tokenize.py check` fails the review if
a literal is left behind.

## What is next

Release B (steps 7 to 11): the identity system (shape for kind of thing, colour for kind of data), the editor restyle, the operator launcher restyle with 48 to 56 px targets,
Admin and Help, a "What changed" page in Help. Then the retiring-definitions roadmap (`docs/roadmap/retiring-definitions.md`).

# Roadmap: Keyboard at the bottom, and a focus mode when a field is hidden

Status: **Built in 0.71.0** (see `docs/KEYBOARD-AND-FOCUS.md`). Decisions made 25 Nov 2026. Raised 25 Nov 2026.

## Problem

1. On a terminal the on-screen keyboard can cover the field being typed into, or the text around it, so the operator cannot see what they are entering.
2. The number pad sits to the right of the screen on wide screens, and the text keyboard sits along the bottom. The pad should come up at the bottom the same way.

## What the code does today (`kernel/fp-keyboard.js`, 0.43 to 0.46)

- The platform has **its own** on-screen keyboard. It keeps the device's own keyboard away (it sets the field's `inputMode` to `none`, so the Windows touch keyboard does not open).
- **Text** fields get a full keyboard along the **bottom** (344 px tall, with a 56 px bar that shows the field's label and a Hide button).
- **Number** fields get a pad **docked to the right** (320 px wide) when the window is at least 900 px wide and wider than tall; on narrower screens it goes to the bottom (about 300 px tall).
- The page makes room with two CSS variables, `--fp-kb-bottom` and `--fp-kb-right`, which the body padding, sub-form sheets, the save bar and the toast leave free. After the keyboard shows, the field is scrolled to the **middle** of the window (`scrollIntoView({ block: 'center' })`), not to the middle of what is left above the keyboard.
- A form can ask for the keyboard to be always shown (`keyboard: always`); then the pad's place stays reserved on a wide screen.

## Can it tell when the keyboard hides the field? Yes.

| What to check | How |
|---|---|
| Our own keyboard's size | Known exactly: `panel.offsetHeight` and `--fp-kb-bottom`. The field's position is `getBoundingClientRect()`. The visible space is the window height minus the keyboard, minus the save bar, minus the tinted form head. |
| The device's keyboard (Windows touch keyboard, a tablet's), if it opens anyway | Edge supports the **VirtualKeyboard API** (`navigator.virtualKeyboard`, set `overlaysContent = true`; the `geometrychange` event and `boundingRect` give the keyboard's rectangle). `window.visualViewport` (its height shrinks on some devices) is the fallback. |
| When to check | After the keyboard shows and the scroll settles, on `resize` / `geometrychange` / `visualViewport` resize, and whenever focus moves to another field. |
| What counts as "hidden" | The field or its label is below the visible area or above it, **or** less than a minimum of room is left (proposed: the field, its label and its error line cannot all show at once, about 120 px). |

## What is proposed

### 1. The number pad at the bottom
- The pad always docks along the bottom, like the text keyboard, on every screen size. The right-hand dock and the reserved right place go away.
- To keep it short, the pad becomes wide and low (about three rows of five keys, around 250 px with the bar, against 344 px for text) instead of the tall phone-style 3 by 4 grid. The key order and sizes (56 px keys) are a design step with the owner (open question 3).

### 2. Focus mode (when the field is hidden or the room is too small)
- While the field is hidden or squeezed, the keyboard's bar becomes a **typing card** just above the keys: the field's **label**, the **value as typed (large, with the caret)**, its **unit or hint** (for example °F) and any **error line**, with **Back** and **Next** keys to move between fields. The operator sees what they enter without the form being visible.
- Focus mode turns on and off by itself: it is shown only while the real field is not fully visible; if the field is visible above the keyboard, the bar stays as it is today (label only).
- A terminal setting could force it **on** for all fields on a small screen (open question 4).

### 3. Fix the cause, not only the symptom
- Scroll the field to the middle of the **free** area (above the keyboard and below the head), not the middle of the window: use scroll padding equal to the keyboard height plus the save bar.
- Check the save bar, the toast and the tinted head against the keyboard so none of them sits on top of the field.

## Build order

1. The detector (`FP.keyboard.hidden(field)`) with the VirtualKeyboard API and `visualViewport` fallbacks, and the scroll fix.
2. The pad to the bottom; remove the right dock and its reserved place.
3. The typing card (focus mode) in the keyboard bar, driven by the detector.
4. Tests: a small window with the keyboard up (the fake VirtualKeyboard rectangle), the field under the keyboard, the card showing the value; the field above the keyboard, the card not showing; the pad always at the bottom; screenshots day and night. Real-terminal checks listed below.
5. Help, the Guide and the Spec text.

## To check on a real terminal

- The smallest terminal screen, with the pad and the full keyboard, with a field near the bottom of a long form.
- Whether the Windows touch keyboard ever opens (it should not) and, if it does, that the detector sees it.
- A gloved thumb on the pad keys, and the Next / Back keys.

## Decisions (owner, 25 Nov 2026)

1. **The platform's own keyboard is what hides things** (not the Windows touch keyboard). The detector therefore works from our own keyboard's known size first; the VirtualKeyboard API and `visualViewport` stay as a fallback.
2. **The design target is a 1200 x 800 landscape screen** (the smallest terminal). With a 344 px text keyboard that leaves about 456 px above it, less the form head and the save bar, so the form must be checked at that size.
3. **The number pad is the wide, three-row pad along the bottom** (not the tall phone-style pad).
4. **Focus mode shows only when the field is hidden** (or too little room is left), never always.

### Consequences chosen for the build

- With the pad at the bottom, a form that asks for the keyboard to be always shown (`keyboard: always`) no longer reserves a place on the right. While no field is focused its pad **rests as the 56 px bar only** ("Tap a box to type") and opens to the full pad when a field is tapped, so the form is not squeezed all the time.
- Tests that checked the right-hand dock are rewritten for the bottom pad.

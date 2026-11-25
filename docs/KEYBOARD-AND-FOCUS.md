# Number pad at the bottom and focus mode (0.71.0)

Built from `docs/roadmap/keyboard-and-focus.md` (owner's decisions: the platform's own keyboard is what hides fields; design target 1200 x 800 landscape; a wide three-row pad; focus mode only when a field is hidden).

| What | How it works |
|---|---|
| Number pad | Always along the bottom, full width, about 250 px (a 56 px bar plus three rows of at least 56 px). Keys: `7 8 9 ⌫ Clear` / `4 5 6 ± .` / `1 2 3 0 Next`. The right-hand dock and its reserved place are gone (`--fp-kb-right` stays defined as 0). |
| Forms that always show the keyboard (`keyboard: always`) | With no box selected the panel rests as the 56 px bar only ("Tap a box to type"), and expands to the pad or the 344 px text keyboard when a box is tapped. |
| Detector | `FP.keyboard.hidden(field)` returns `{ hidden, free, reason }`. The free area is between the launcher bar and the form head above and the keyboard (or the sticky save bar, whichever is higher) below. Hidden means the box, its label or its message is outside the free area, or less than 120 px is free. It re-checks after scroll settles, on resize, visual viewport and `geometrychange`, on focus, each input and DOM changes. A device keyboard is read through `navigator.virtualKeyboard.boundingRect` and `visualViewport` (read only). |
| Scroll | The box (with its label and message) is centred in the free area, or its top is put at the top of the area if it is taller. Replaces centring in the whole window. |
| Typing card | Only while the detector says hidden: the top bar becomes a card about 120 px tall with the field's name and hint, the value at 32 px with a caret, the unit, the form's message, and Back, Next and Hide. It mirrors typing, and turns itself off when the box is in view. |

## Decisions made on the way

1. **Hysteresis:** the detector judges as if the card's extra 64 px were not there. Without that the card flickered on and off (it made the keyboard taller, the field then looked visible, the card went off, and so on). Consequence: a box visible by less than 64 px behind the card counts as visible.
2. The pad's key order puts the rarely used keys at the right edge, with Next at the bottom right.
3. `FP.keyboard.showing()` also reports whether the card is on.

## Honest notes

At 1200 x 800 the sticky save bar is about 85 px tall, so with the 344 px text keyboard about 370 px are left above the keyboard, less the launcher bar and the form head. It works but it is not roomy. The "." and "±" glyphs are small against the digits. Not checked: night mode screenshots, a real touch screen with a gloved thumb, and the real Windows touch keyboard (the VirtualKeyboard path was tested only with a faked rectangle).

## Tests

`l188` (the pad at the bottom, key order and every key, the resting bar, never), `l189` (the free-area scroll, no card when visible, the card on a 1200 x 420 window and a faked device keyboard, Back and Next), `l67` updated for the bottom pad.

# Full screen on a terminal (0.69.0)

A terminal or terminal group can be set to go full screen on the first tap, and every launcher has a visible Full screen button.
A web page cannot enter full screen by itself (the browser needs a tap or key press), so the first tap after launch does it. For a true kiosk with no tap, start Edge with a shortcut
(`--kiosk <address> --edge-kiosk-type=fullscreen`); that is outside the platform.

| Where | What |
|---|---|
| Setting `fullscreen` | A boolean on terminal groups and on a terminal's own settings, handled exactly like `view`: a group's value wins for its terminals, a terminal in no group uses its own, unset is off. Pack export and install carry it. |
| Admin | **Full screen** next to View in the group editor and the terminal card: "Normal" or "Full screen on the first tap". A terminal in a group shows the group's value in its read-only summary. |
| Launcher | With the setting on, the first pointer press or key press calls `requestFullscreen()`; after that only a pointer press re-enters (so typing never fights Esc). The gesture is never delayed or cancelled. Never in the editor or on a simulated terminal. |
| Toggle | A **Full screen** / **Exit full screen** button on the launcher bar for everyone, 48 px, follows the real state, hidden when the browser has no Fullscreen API. |

Test: `l184` (the Fullscreen API is stubbed and counted, since headless Chromium cannot really go full screen).

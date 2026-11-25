# Universal clock (0.72.0)

Built from `docs/roadmap/universal-clock.md`. Every terminal follows the host PC's clock instead of its own.

## How it works

| Part | What |
|---|---|
| Measure | `FP.clock.measure()` writes `_clock/<terminal>.probe.json`, reads the file's last-modified time back (stamped by the host on a shared folder), corrects for the round trip, takes the median of three probes, drops a probe over 2 s, and treats offsets within +-2 s as 0. Never throws. |
| Apply | A second offset, `universal`, beside the test clock's, in `fp-core.js` (`FP.pageClock`). The page clock is the real clock plus the test offset plus the universal offset. **On a test folder that is using the test clock the universal clock is never applied.** An offset is applied only between entries (it waits up to 5 s for a save in flight); a change within 2 s of the current one is ignored. The entry layer's ordering rule is untouched. |
| When | At start-up (from the gate's `finish()`), every 5 minutes, and when the window returns to the front (at most once per 20 s). A failed measurement keeps the last good offset and marks it stale. |
| Setting | `_clock/settings.json` `{ enabled }`, **on by default**; `FP.clock.setEnabled` is admin only. Off means no probing, no clock note and no alert. |
| Clock note | While a terminal's own clock differs from the host's by more than 60 s, every entry it saves carries `clockWarn: { ownVsHostMs, appliedMs }` (absent otherwise). The record view, print, Find and Admin > Records show "This terminal's clock was N min off; host time was used." |
| Admin alert | A standalone alert (`kind: clock`, no ladder and no center) shown to every admin, raised once per terminal and episode, closed by itself when the clock is back within a minute or when the setting is turned off. An admin can acknowledge it. |
| Admin > Speed > Clock | The on/off switch (48 px), this PC's state, and a table from `_clock/*.json` with the terminals more than a minute off first. |

## What could go wrong on a real shared folder

- **The host's own clock must be right.** If its Windows time is wrong, every terminal now follows the wrong time.
- **Share timestamps.** It relies on the share returning the host's modified time. A share that returns the client's time gives offset 0 (harmless); one that returns stale times looks like a wrong offset; a share with coarse timestamps (over about 2 s) could make the offset flap.
- **A clock jump backwards** (the first measurement, or Windows correcting the host's time) means a sign-in made within the jumped span reads as "not open yet" until the clock catches up, so someone signed in a few minutes earlier can briefly appear signed out. At start-up it happens before sign-in; a mid-day host correction could do it. Not tested on a real folder.
- Due and alert times shift with the clock; the ordering safeguard covers items where the writer passes `after`.
- Several tabs of one terminal write the same probe file; the median tolerates one bad probe.
- Each terminal writes two small files in `_clock/` every 5 minutes.

## Decisions made on the way (change any)

1. Disabled turns off the note and the alert as well as the offset.
2. The launcher bar chip ("this PC is 3 min fast") from the roadmap is not built; admins get the alert card on the launcher home and the Admin card, operators see nothing.
3. `_clock/` is left behind on Purge (adding it would change the folder counts the purge tests check).
4. A retired terminal never writes probes.

## Tests

`l190` (measuring), `l191` (applying, the note thresholds, the in-flight wait, the ordering rule, the test clock winning), `l192` (the Admin card, the alert, a plain user refused). The test fake stamps `_clock/` files from the real clock plus a controllable host offset; all other files are unchanged.

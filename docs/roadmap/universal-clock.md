# Roadmap: A universal clock

Status: **Built in 0.72.0** (see `docs/UNIVERSAL-CLOCK.md`). All decisions made 25 Nov 2026. Raised 25 Nov 2026.

## Problem

Every terminal stamps its entries with its own PC's clock. Entry order, "what was the latest value", due times, late and missed duties, sign-in expiry and shift reports all depend on those clocks agreeing. Today the platform relies on Windows time sync being on for every terminal (an open question for IT in the Spec) and only limits the damage when clocks disagree: an entry never sorts before the previous one for the same item (it is stamped one millisecond later and keeps its own reading in `clockAt`), and a terminal more than a minute ahead raises a warning. A PC with a wrong clock, a tablet that was off for weeks or one that is on the wrong time zone still stamps wrong, and the fix is on each PC.

## Idea

Now that the data folder is on one always-on host (`docs/DEPLOYMENT.md`), **the host's clock can be the one time everyone follows.**

1. **Measure.** A terminal writes a tiny probe file into the shared folder (for example `_clock/<terminal>.json`) and reads the file's last-modified time back (the browser's `File.lastModified`). On a shared Windows folder that time is set by the host, so (host time) minus (this PC's time at the moment of writing, corrected by half the round trip) is this PC's **offset**. No extra service and nothing to install.
2. **Apply.** The page's clock is shifted by the offset, using the mechanism the test clock already uses (`FP.testClock` / `applyOffset` in `fp-core.js` replaces `Date` for the page and announces an `fp-testclock` event). Everything that reads the time (entries, due times, alerts, sign-in expiry, displays) then reads host time.
3. **Keep it honest.** Re-measure at start-up, every few minutes and when the window comes back to the front. Use the median of a few probes, ignore a probe whose round trip is large, never move the clock backwards while an entry is being made, and never apply it on a test folder that is using the test clock.
4. **Show it.** The launcher and Admin say how far this PC's own clock is from the host's ("this PC is 3 min fast; using host time"). A setting turns the whole thing on or off for the folder. Admin > Speed or the clock warning lists terminals whose own clocks are far off, so IT can fix them, even though the platform now works around it.

## Rules and limits

- **The host's clock must be right.** The universal clock is only as good as the host's Windows time sync. The health check (`docs/roadmap/data-health-and-restore.md`) and the host's own setup should confirm it.
- **Time zones:** stamps stay in UTC with the local offset kept for display, as now. The universal clock moves the instant, not the zone.
- **Offline:** a terminal that cannot reach the host keeps the last offset it measured, and says so; it never invents one.
- **Granularity:** shared-folder timestamps can be coarse (a second or two on some file shares). That is fine for ordering saves made seconds apart and for due times measured in minutes; it is not a stopwatch.
- **Not a security feature:** a person who changes their PC clock can still change what the PC thinks, before the next measurement. The ordering safeguard (never earlier than the previous entry for the item) stays.

## Build order

1. `FP.clock.measure()` (probe write, read-back, round-trip correction, median) with tests on the fake folder, which needs the fake to stamp last-modified from a controllable "host" clock.
2. Apply the offset through the existing test-clock hook; the folder setting; start-up and periodic re-measure.
3. The launcher and Admin messages; the clock-warning pane lists terminals by measured offset.
4. Spec and Guide text; Help.

## Decisions (owner, 25 Nov 2026)

1. **On by default** for the folder (an admin can turn it off).
2. **One-second timestamps from the share are good enough.** No host software is added.
3. **A terminal with a badly wrong own clock only gets a warning; saving is never blocked.** The warning is **recorded with the record**: when a terminal's own clock differs from the host's by more than a threshold (proposed: one minute), every entry it saves carries a small clock note (`clockWarn`: how far its own clock was off, and the offset that was applied), so a reader of the record or a report can see that the time came from a corrected clock. Entries from a terminal within the threshold carry no note.

## Build order additions from the decisions

- Step 2 (apply the offset) sets the folder setting to **on** by default.
- A new step between 2 and 3: the entry layer adds the `clockWarn` note when the measured difference passes the threshold (it is part of the entry, so it appears in history, records and exports; it never changes the entry's values or its ordering rules).
- The Records and Find views show the note on an entry ("this terminal's clock was 4 min off; host time was used").

## Decisions, second round (owner, 25 Nov 2026)

4. **The threshold is one minute.** A terminal whose own clock differs from the host's by more than one minute gets the clock note on its entries and counts as "badly off".
5. **A badly off clock alerts an admin.** It raises an alert (through the existing alerts and ladder, `FP.alerts`) naming the terminal and how far off it is, so it reaches an admin as well as being recorded and shown in Admin. The alert closes itself when the terminal's clock is back within a minute. It is raised once per terminal and episode, not on every entry.

## Open questions left

- None. **Decided 25 Nov 2026:** the alert goes to admins; choosing a responsibility center to receive it is a later option, not part of the first build.

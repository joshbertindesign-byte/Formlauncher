# Roadmap: A universal clock

Status: **Proposed (not agreed or built).** Raised 25 Nov 2026.

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

## Open questions for the owner

- Should it be **on by default** for the folder, or off until an admin turns it on?
- Is a one-second timestamp granularity from the share acceptable, or should the host also run a small service that reports the time? (Today the platform has no host software; this keeps it that way.)
- What should happen when a terminal's own clock is far off: only warn, or also block saving on that terminal?

# Roadmap: Live terminal health

Status: Proposed (not built). Small platform change; most of the value comes from one new built-in
structure and a board that reads it.

## Why

The platform has no server, so the terminals and the synced folder are the system. When something
goes wrong it usually goes wrong quietly: a terminal stops syncing, a clock drifts, saves pile up
in one terminal's outbox where nobody else can see them, a terminal sits on an old release. Today
the problem shows on the affected terminal, or in a weekly report. Nobody can see the plant as a
whole while it is happening.

## What already exists

| Part | What it does today | Gap |
| --- | --- | --- |
| Outbox dot | A terminal shows when saves are waiting; they retry every 30 seconds | Only that terminal knows. A terminal with 40 saves stuck is invisible to everyone else |
| Clock warning (0.45) | Red notice on a terminal's home when clocks disagree by more than a few minutes | Appears on the screens that notice, not in one place with numbers per terminal |
| Admin > Speed | How long each terminal takes to open forms and load structures, red over a limit | Snapshot only, no history, not shown to supervisors |
| Terminals list | Each terminal's site, last seen, kernel and browser | "Last seen" says nothing about whether it is writing, behind, or stuck |
| Records health | Broken fingerprint chains, duplicate IDs saved on two terminals | Admin only, per structure, checked on request |
| Release fallback | A half-synced terminal keeps running the older complete release | No list of who is on an old release and for how long |
| Weekly `health.csv` | Unreadable lines, uncommitted submissions, clashes, checkpoint mismatches | A week late |

## What it is

1. **A heartbeat.** Each running terminal writes a small status entry on a timer. It says who it
   is, what release it runs, how many saves are waiting and how old the oldest is, when it last
   wrote successfully, how far its clock is from the newest entry it has seen, and how fast it
   loads. It carries no names and no form data.
2. **Rules.** A short list of checks over those entries, with limits an admin can change. Each
   terminal gets a state: OK, Watch, Problem or Silent, and a reason in plain words.
3. **A board.** Admin > Health shows every terminal by site and group, coloured by state, with the
   reason and what to do about it. A small status dot in every terminal's top bar shows its own
   state in the same words.

## The checks

| Check | Problem when | Plain-words fix shown |
| --- | --- | --- |
| Heard from | No heartbeat for N minutes during a time the terminal is expected to be running (an open run, a shift) | "T04 has gone quiet. Is it on? Is OneDrive signed in?" |
| Saves waiting | Outbox not empty for N minutes | "3 saves are waiting on T04 and the oldest is 12 minutes old. Check the network and the OneDrive tick." |
| Clock | More than N minutes from the others | "T05's clock is 3 minutes ahead. Set Windows time sync." |
| Release | Running an older release than the current one for more than N hours | "T02 is still on 0.62. Its files haven't finished syncing." |
| Sync delay | Time for a marker written on one terminal to reach another is over the target | "Saves take about 90 seconds to reach other terminals." |
| Speed | Forms or structures slower than the limit | Existing Admin > Speed limits |
| Data checks | Broken chain, duplicate ID, unreadable line | Existing Records health, summarised here with a count |
| Data folder | Conflict copies of files, files that don't belong, folder size jumping | "OneDrive made a second copy of a file in data\racks." |
| Weekly tables | Last weekly batch is older than a week or reported a failure | "The weekly tables were last built Nov 22." |

The board also answers two questions the spec leaves open: whether terminal clocks agree (shown
with numbers, not a guess) and how long a save really takes to appear on another terminal.

## Who sees what

- **Operators:** their own terminal's dot and message only, in plain words. It extends the
  existing outbox dot and clock notice into one status.
- **Supervisors:** a simple dot per terminal at their site.
- **Admins:** the full board, reasons, history and the limits.

## Proposed build steps

| Step | What | Size | Done when |
| --- | --- | --- | --- |
| H1 | **Heartbeat.** A built-in `heartbeats` structure and writer: every 15 minutes while the page is open, and immediately when something changes (outbox starts or empties, release changes). Written to its own small file per terminal per day, apart from the data files. | M | Admin can see each terminal's latest heartbeat and its fields. File growth is measured and acceptable. |
| H2 | **Sync delay probe.** A terminal writes a timestamped marker. Others record when they first see it. Report the typical and worst delay per pair of terminals. | M | A number for how long a save takes to reach another terminal, per site, on real terminals. |
| H3 | **Rules and states.** Library functions for each check and an editable rules structure (limits, expected-running window from the open run or Usual shifts). A state and reason per terminal. | M | A terminal with a bad clock, a stuck outbox or no heartbeat is given the right state and words in a test. |
| H4 | **Admin > Health board.** Tiles by site and group, reasons, fixes, and a short history strip for outbox, clock drift and speed. Uses the new colour and shape rules from the UI refresh. | M | Board matches the heartbeat data. Tapping a tile shows what to do. |
| H5 | **Top-bar status.** One dot and one plain sentence per terminal, replacing the separate outbox dot and clock notice. | S | Each existing warning still appears, now with one place to read it. |
| H6 | **Data folder checks.** Conflict copies, stray files, folder size and file count, and when the weekly batch last ran (the flow writes a small status file). | M | Each is listed with where it is and how to fix it. |
| H7 | **Reporting.** Heartbeats and rule results in the weekly tables, and a Plant health page in Power BI. Older heartbeats thinned to one an hour after 14 days. | S | Power BI shows uptime and problems by terminal over time. |
| H8 | **Alerts.** Notify an admin when a terminal goes Silent or a problem lasts N minutes. | Later | Waits for the Power Automate dispatcher. |

H2 is useful on its own and should go first: it is the measurement the andon call depends on.

## Risks

- **It adds load to the thing it measures.** Every heartbeat is a write the OneDrive client has to
  upload. Keep heartbeats small, write to a separate file, and use 15 minutes by default. Measure
  the effect in H1 before adding more fields.
- **A terminal that can't reach the folder can't report.** Silence is the signal, so "Silent" is
  worked out by the others from the absence of heartbeats, not by the broken terminal.
- **False alarms.** A PC that is off at night is not a problem. "Heard from" only applies during an
  expected-running window. That needs real shift times, which is an open question (Usual shifts).
- **A sleeping browser tab stops timers.** Terminals that go to sleep with the page open can look
  Silent. Check how the pilot terminals are set up, and ask IT for no sleep on line terminals.
- **Privacy.** The heartbeat carries no user names and no form data.

## Open questions

1. Limits: how many minutes is "silent", how old can a waiting save be, how far apart can clocks be?
2. Who gets the full board, and who gets only their site?
3. The real shift times, so "expected to be running" can be worked out.
4. Is Windows time sync on for every terminal? The board will show it, but IT should confirm.
5. Does the shared Windows folder decision change the sync checks? It would remove the sync delay,
   and the delay probe (H2) is the evidence for that decision.
6. How long to keep heartbeats before thinning or archiving them.

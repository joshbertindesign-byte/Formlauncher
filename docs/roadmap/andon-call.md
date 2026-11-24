# Roadmap: Andon call

Status: Agreed direction (not built). Most of it is a pack of definitions on the existing platform;
only the wall display and the alerts need new platform work.

## What it is

An operator taps one large **Call for help** button on a line terminal, picks the kind of help
(Quality, Maintenance, Material, Supervisor) and is done. The call appears on boards in red with a
timer, the right people are made responsible for answering it, and it escalates if nobody does.
Every call keeps its times (called, acknowledged, resolved), so response time becomes data.

## What it is not

- **Not a safety or emergency system.** Emergencies follow the plant's own procedures. A call can
  arrive late (see Risks).
- **Not machine control.** The platform can't stop a line. "Line stopped" is something the person
  says, not something it does.

## What it reuses

| Need | Existing part |
| --- | --- |
| A call that is open until handled | **Cases** structure kind: Open, Acknowledged, Closed, with When closed, When acknowledged, Who handles, Due |
| Line, run, shift, operator filled in | Carried values from the open run and `HERE()` |
| Who must answer, and when it is late | **Responsibility centers** and **Due** duties, item by item for structures that open and close (0.56, 0.60): Late after, Missed after, Critical, one miss recorded, supervisor can Excuse |
| Seeing what is due or late | Home page starts with what is due, late or missed; tiles get badges |
| A tile per call, coloured by status | `board` visual |
| Response-time and cause reports | `pareto`, records table, grouped pivot, weekly tables for Power BI |

## The flow

1. **Call for help** (line terminal, one tap from the home screen). Kind of help, optional one-line
   note and photo. Line, run, shift and operator come from the open run. Saves a new item in
   **Calls**.
2. **Routing.** Each kind of help belongs to a responsibility center (Quality, Maintenance,
   Material handling, Supervisors). Responsibility follows sign-in, so the person signed in at the
   center's terminals or named in it is the one it is due from.
3. **Acknowledge.** **On my way** saves who and when. The tile changes from red to amber.
4. **Resolve.** **Resolved** closes the call with a short note and a cause choice. It can also
   record that the line stopped and for how long.
5. **Escalate.** A second duty owned by the Supervisors center becomes due when a call has been open
   and unacknowledged longer than the first center's limit. Nothing is deleted or reassigned. A
   call that passes its Missed time is recorded as a miss, the same as any missed duty.
6. **Cancel.** The caller can cancel within a minute (closed with the outcome "cancelled by
   caller"), so false taps don't count against response times.

## Screens

- **Operator:** a **Call for help** button on the line terminal's home, with the call's current
  state (Waiting, Someone is coming, Resolved) on the same tile after it is sent.
- **Responders:** the launcher's due list, plus a Calls board in the QC office and wherever else
  one is placed.
- **Wall display:** a full-screen Calls board, no sign-in, large type, red when unacknowledged,
  with a timer. Shares the night palette and tokens from the UI refresh.
- **Line board:** the tile for a line turns red while it has an open call.
- **Reports:** response time (called to acknowledged, called to resolved) by line, shift and kind of
  help; a Pareto of causes; repeat calls by profile.

## Proposed build steps

| Step | What | Size | Done when |
| --- | --- | --- | --- |
| N1 | **Calls structure and Call for help form** as a pack: a Cases structure, the kinds of help, carried values from the open run, one-tap launch from the line home, cancel within a minute. No platform change. | S | A call from a test terminal creates an item with line, run and shift filled in. |
| N2 | **Respond forms:** On my way (acknowledged time and Who handles from the sign-in) and Resolved (note, cause, optional line stopped). | S | A call can go Open, Acknowledged, Closed, with every time in its history. |
| N3 | **Routing and escalation with Due.** One responsibility center per kind of help, an item-by-item Acknowledge duty (Late and Missed times set per kind, Critical), and a second duty for Supervisors that applies while a call is open and unacknowledged. | M | A call nobody answers shows late on responders' homes, then on the supervisors' home, and a miss is recorded once. |
| N4 | **Calls board** (board visual): tile per open call with line, kind, a waiting timer and who is coming, coloured by state and age. The line board tile turns red when its line has an open call. | M | Boards match the item list. A resolved call leaves the board after a set time. |
| N5 | **Wall display mode:** a launchable form flag for no sign-in, full screen, large type, and a refresh interval short enough for calls (see Risks). An optional chime on a new call, started once by a tap because browsers block sound otherwise. | M | A wall PC shows a new call within the target time on the real shared folder. |
| N6 | **Reports:** response times, cause Pareto, repeats by profile; Calls added to the weekly tables. | M | The weekly CSVs include calls with their three times, and the Power BI page can show response time. |
| N7 | **Alerts via the dispatcher.** Notify the center's members on a new call and on escalation. | Later | Waits for the Power Automate dispatcher. |
| N8 | **Calls from other places** (QC office, warehouse) with their own kinds of help and centers. | S | A second terminal group has its own kinds and routing. |

N1 to N4 are a pack and can be built and trialled on a test terminal now. N5 is the only step that
needs a new platform release, and it shares its work with the UI refresh (night palette and tokens).

## Risks

- **Delay is the main risk.** Today the data folder syncs through OneDrive, so a call saved on one
  terminal can take seconds or minutes to appear on another. That is wrong for a call for help. First
  measure the real delay on the pilot terminals. If it is too long, the open question about moving to
  a shared Windows folder (which removes sync delay) becomes a requirement for this feature.
- **Refresh time.** Dashboards reload "every few minutes". A form setting already exists for
  refresh time, but the lowest value it allows must be checked and probably lowered for the Calls
  board.
- **Boards nobody looks at.** Until alerts exist (N7), a call is seen only if a person is near a
  screen. Where the wall displays go matters as much as the software.
- **Alarm fatigue.** If every call is Critical, nothing is. Use Critical only for the Missed
  threshold.
- **False calls.** The one-minute cancel and an "answered, no action needed" cause keep them out of
  the response-time figures.

## Decisions and open questions

1. The kinds of help and who is in each responsibility center, per site.
2. Response targets: how many minutes until Late, Missed and escalation, per kind of help.
3. Whether a call that stops the line is also a downtime case. One structure for both avoids
   double entry, but downtime may already have its own reporting. Needs a decision before N2.
4. Where wall displays will be and who owns them.
5. Whether the shared Windows folder question gets decided now because of this.
6. Whether the operator should see who is coming by name, or only that someone is.

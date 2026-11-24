# Change the data folder (0.68.0)

Problem (production): the data folder moved on a terminal's PC. The browser kept the old folder's handle, so the start-up screen kept asking "Tap Start" for a folder that no longer existed, with no way to choose another short of clearing browser data (which also loses the terminal ID and site).

## What was built

| Where | What |
|---|---|
| `FP.folder.check()` | Verifies the stored folder still works without prompting: `{ ok, name }` or `{ ok:false, reason: none/gone/denied/prompt }`. A busy sync folder is not treated as gone. |
| `FP.folder.change()` | Opens the picker (from a click), stores the new handle under the same key, clears the offline copies of the old folder (users, sites, definitions) and the data caches, and flags a reload. Terminal ID, site, device key and the outbox are untouched. |
| Start-up gate | "Tap Start" has **Choose a different data folder**. A failed Start says "The data folder was not found. It may have moved or been renamed." and keeps that button. If permission is still granted but the folder is gone: a card "The data folder is not there any more" with **Choose the data folder again** and **Try again**. |
| Launcher | **Change data folder**, next to Reconnect, for supervisors and above (also on a shared terminal). A confirm says what happens; the page reloads after. |
| Editor, Admin | A **Data folder** card at the top of the Test folder pane: the current folder's name and **Choose a different folder** (admins). |

## Worth knowing

- Choose the **same data in its new place**. If the new folder is empty or a different copy, the existing "set this terminal up again" logic clears the terminal ID; the confirm says so.
- Anything waiting to save on the terminal is written into the **new** folder.
- A stuck terminal can also be freed from the console: `FP.folder.forget().then(() => location.reload())`.

## Tests

`l183` (the Admin card, the launcher button by role, the gate with a refused and with a gone folder). The test fake gained `dead` and `prompt` flags and `__newDir`/`__pick` helpers; other tests behave as before.

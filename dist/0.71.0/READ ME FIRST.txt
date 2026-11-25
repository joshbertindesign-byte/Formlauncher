FORM PLATFORM: READ ME FIRST
============================

This folder IS the platform. There is no installer and no server software. It runs in Microsoft Edge from a folder that is
shared with every terminal: a shared Windows folder on an always-on host PC, mapped as a drive (for example Z:) on every terminal and on the
editor PC. Keep a nightly backup of that folder (see the ops/backup scripts in the repository).

FIRST INSTALL (a new, empty folder)
 1. Copy everything in this folder (launch.html and the runtime folder) into the shared folder.
    If you unzipped FormPlatform-X.Y.Z.zip, open the FormPlatform-X.Y.Z folder inside it and copy what is in there.
    Do not add another folder level: launch.html must sit at the top of the shared folder.
 2. Check each terminal can open the shared folder (the mapped drive) and see launch.html in it.
 3. On a terminal, open launch.html in Edge. It asks you to choose the data folder: choose the shared folder (the folder that holds
    data, library and runtime). If the folder moves later, use Change data folder on the launcher or in Admin.
 4. Give the terminal an ID (for example T01) and pick or create its site. Then create the first admin (name and a
    6-digit PIN). That person can then open the editor (runtime/editor.html) to build structures and forms.
 5. Share launch.html with the other terminals (a shortcut to it on each desktop). Each sets its own terminal ID once.

UPDATING A FOLDER THAT IS ALREADY IN USE
 Do not copy this whole folder over it. Use the update file instead:
 1. Save kernel-X.Y.Z.zip into the shared folder's "updates" folder (create it if it is missing).
 2. An admin opens the editor, then Admin > Updates, and installs it. Every file is checked before anything changes.
 3. The three newest releases are kept, so Admin > Updates can go back if something is wrong.
 Your data (the "data" folder), people, forms and settings are never touched by an update.

TRYING IT OUT: THE TEST PACK
 packs/Test pack.json is a complete example with made-up data: profiles, lines, needs, shifts, runs, hour checks,
 racks, partial racks, the needs board, trace and production report, two terminal groups, four responsibility
 centers with an escalation ladder, and two instruction files in the media library.
 1. Use a TEST folder only (Admin > Test folder marks one; it lets the pack add six test people).
 2. In the editor open Admin > Packs, choose "Test pack.json" and install. Installing again changes nothing.
 3. Test people (PIN): Sam Supervisor 135790, Quinn Quality 975310, Mo Manager 579135, Olive Operator 246802,
    Omar Operator 357913, Pat Packer 468024. Terminal T01 is the line terminal, T02 the QC office.
 Never install the Test pack on a folder with real data or real people.

WHAT IS IN THIS PACKAGE
 launch.html            the page every terminal opens
 runtime/               the platform: boot.js, releases.js (which release runs), the pages, and one folder per release
 packs/                the Test pack (optional; see above)
 No data, no people and no forms are installed: a new folder starts empty.

TROUBLESHOOTING
 - A red "Problem found" bar at the top: a file could not be read (a copy still being written, or the folder is not reachable). Wait and reload; check the host PC is on and the drive is connected.
 - "The data folder is not there any more": the host or the drive is off, or the folder moved. Reconnect it, or choose the folder again.
 - "This browser cannot unzip files": use Microsoft Edge.
 - Never edit the files in runtime/ by hand. Updates replace them.

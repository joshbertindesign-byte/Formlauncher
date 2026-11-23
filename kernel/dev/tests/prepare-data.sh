#!/bin/bash
# Gets the pilot test data the tests need but that is not committed (it holds production part numbers).
# It is read out of the WIP zip that is already in the repo, into the git-ignored pilot folders.
# Usage: prepare-data.sh        (called by regress.sh)
cd "$(dirname "$0")"
REPO="$(cd ../../.. && pwd)"
ZIP="${PILOT_DATA_ZIP:-$REPO/Forms b/form-platform-repo-wip-0.61-0.62.zip}"
need=0
for f in pilot/profiles.json pilot/production-pilot.json pilot2/profiles.json pilot2/production-pilot.json; do [ -s "$f" ] || need=1; done
[ $need = 0 ] && exit 0
if [ ! -f "$ZIP" ]; then
  echo "Pilot data missing and no zip to read it from ($ZIP). Set PILOT_DATA_ZIP, or put the pilot files in dev/tests/pilot and pilot2." >&2
  exit 1
fi
for f in pilot/profiles.json pilot/production-pilot.json pilot2/profiles.json pilot2/production-pilot.json; do
  [ -s "$f" ] || unzip -p "$ZIP" "dev/tests/$f" > "$f" || { echo "Could not read dev/tests/$f from the zip." >&2; exit 1; }
done
echo "pilot data extracted from $(basename "$ZIP")"

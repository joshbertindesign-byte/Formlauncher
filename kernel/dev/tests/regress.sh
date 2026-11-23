#!/bin/bash
# Regression for the kernel in this folder. It builds every starting point (seed) it needs, so nothing depends on
# files made earlier on someone else's computer. See docs/TESTING.md.
#
#   dev/tests/regress.sh                 everything (about 25 minutes)
#   dev/tests/regress.sh l92 l93         only those tests (seeds are made first if missing)
#   dev/tests/regress.sh --fresh         throw the made seeds away and build them again
#
# Result: out/results.txt. Exit 1 only if a test fails that is not listed in known-failing.txt.
cd "$(dirname "$0")"; export TZ=America/Chicago
FRESH=0; ONLY=()
for a in "$@"; do if [ "$a" = "--fresh" ]; then FRESH=1; else ONLY+=("$a"); fi; done
T="$PWD"; mkdir -p out; : > out/results.txt
./prepare-data.sh || exit 2
if [ $FRESH = 1 ]; then rm -f dummies/snap*.json pilot2/snap*.json out/*.json dummies/.seed-clock; fi

bad() { grep -Eq 'errs? +: \[[^]]' "$1" || grep -Eqi 'pageerror|TimeoutError|^Error:|Unhandled' "$1"; }
note() { echo "$1" | tee -a out/results.txt; }
UNEXPECTED=0
known() { grep -E "^$1( |$)" known-failing.txt 2>/dev/null | head -1; }
run() {   # run <name> <dir under dev/tests> <command...>: PASS, FAIL or KNOWN-FAIL
  local name=$1 dir=$2; shift 2
  ( cd "$T/$dir" && timeout 600 "$@" > "$T/out/$name.log" 2>&1 ); local rc=$?
  if [ $rc -eq 0 ] && ! bad "$T/out/$name.log"; then
    if [ -n "$(known "$name")" ]; then note "UNEXPECTED-PASS $name  (remove it from known-failing.txt)"; else note "PASS  $name"; fi
  elif [ -n "$(known "$name")" ]; then note "KNOWN-FAIL $name  $(known "$name" | cut -d' ' -f2- | cut -c1-110)"
  else note "FAIL  $name  (see out/$name.log)"; UNEXPECTED=1; fi
}
wanted() { [ ${#ONLY[@]} -eq 0 ] && return 0; for t in "${ONLY[@]}"; do [ "$t" = "$1" ] && return 0; done; return 1; }

# Seeds: made once, reused. Each is a data folder saved after a scripted build.
# The whole run uses ONE shifted clock (FP_SEED_OFFSET_MS, read by dummies/base.js): the page's clock runs from 12:30 on 2026-11-18
# and moves forward. The tests freeze their own clocks at 13:00 that day, so seeds must be older than that (a seed stamped with
# today's date made a test's writes look older than the seed's, and they lost), and tests with no clock of their own must see
# seeds that are minutes old, not days (an old sign-in has expired). The seed clock is kept in dummies/.seed-clock so a later
# run carries on from where the seeds were made.
SEEDCLOCK=dummies/.seed-clock
if [ -f "$SEEDCLOCK" ] && [ $FRESH = 0 ]; then BASE="$(cat "$SEEDCLOCK")"; else BASE="2026-11-18T12:30:00-06:00"; rm -f "$SEEDCLOCK"; fi
SEED_OFFSET=$(node -e "console.log(Date.now()-Date.parse('$BASE'))")
export FP_SEED_OFFSET_MS=$SEED_OFFSET
SEED="env FP_SEED_OFFSET_MS=$SEED_OFFSET"
if [ ${#ONLY[@]} -eq 0 ] || [ ! -f dummies/snap15.json ]; then
  run unit . node kt28.js
  for i in $(seq 0 13); do run chain-$((i+1)) dummies $SEED FROM=$i SNAP=1 node build.js $((i+1)); done
  [ -f dummies/snap15.json ] && [ $FRESH = 0 ] || run l59 . $SEED node l59.js          # l59 saves snap15
fi
# snap15b (the starting point of l60, l64 to l92): the original was made by hand and is lost; this rebuilds it. See docs/SNAP15B.md.
[ -f dummies/snap15b.json ] || run mkseed15b . $SEED node dummies/mkseed15b.js
if [ ! -f dummies/snapPilot.json ]; then (cd dummies && node ../pilot/mkpack.js >/dev/null); run p1 dummies $SEED node p1.js; fi
if [ ! -f pilot2/snapQC.json ]; then (cd pilot2 && node mkpack.js >/dev/null); for q in q1 q2 q3 q4; do run $q pilot2 $SEED node $q.js; done; fi

[ -f "$SEEDCLOCK" ] || node -e "console.log(new Date(Date.now()-$SEED_OFFSET).toISOString())" > "$SEEDCLOCK"

# Every lNN.js from l42 on, in number order (a new test is picked up by being added; nothing to register).
for f in $(ls l[0-9]*.js | sort -V); do
  t="${f%.js}"; n="${t#l}"; n="${n%%[!0-9]*}"
  if [ "$t" = "l59" ]; then wanted "$t" && run "$t" . $SEED node "$f"; continue; fi   # l59 also saves snap15
  [ "$n" -ge 42 ] && wanted "$t" && run "$t" . node "$f"
done
echo; note "$(grep -c '^PASS' out/results.txt) passed, $(grep -c '^KNOWN-FAIL' out/results.txt) known failing, $(grep -c '^FAIL' out/results.txt) failed"
exit $UNEXPECTED

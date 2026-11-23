#!/bin/bash
# The 0.51 pilot: shared line terminals and the QC office PC, step by step (each step starts from the last one's snapshot).
cd "$(dirname "$0")"
export TZ=America/Chicago
node mkpack.js
for s in q1 q2 q3 q4 q5 q6; do echo "== $s"; timeout 900 node $s.js 2>&1 | grep -v "^\s\|^\[\|^'" | cut -c1-700; done

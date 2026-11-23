#!/bin/bash
cd "$(dirname "$0")/../dummies"
export TZ=America/Chicago
node ../pilot/mkpack.js
echo "== p1"; timeout 300 node p1.js 2>&1 | head -12 | cut -c1-300
echo "== p3"; timeout 600 node p3.js 2>&1 | grep -v "^need \|^line " | cut -c1-500
echo "== p4"; timeout 600 node p4.js 2>&1 | grep -v "^form\|msgs\|why" | cut -c1-400
echo "== p5"; timeout 900 node p5.js 2>&1 | grep -v "^  " | cut -c1-900
echo "== p6"; timeout 600 node p6.js 2>&1 | cut -c1-500
echo "== p7"; timeout 600 node p7.js 2>&1 | cut -c1-500
echo "== p8"; timeout 600 node p8.js 2>&1 | cut -c1-600
echo "== p9"; timeout 600 node p9.js 2>&1 | cut -c1-500

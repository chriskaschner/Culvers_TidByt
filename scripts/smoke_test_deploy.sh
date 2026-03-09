#!/usr/bin/env bash
#
# Deployment smoke test for custard.chriskaschner.com
#
# Checks that each page loads successfully, contains the shared navigation
# container, and has a page-specific content marker. Designed to run after
# any GitHub Pages deploy.
#
# Usage:
#   bash scripts/smoke_test_deploy.sh
#   BASE_URL=http://localhost:8000 bash scripts/smoke_test_deploy.sh
#

set -euo pipefail

BASE_URL="${BASE_URL:-https://custard.chriskaschner.com}"
FAILURES=0
PASSES=0
TOTAL=0

# check_page <path> <nav_marker> <content_marker> <label>
check_page() {
  local path="$1"
  local nav_marker="$2"
  local content_marker="$3"
  local label="$4"
  local url="${BASE_URL}/${path}"

  TOTAL=$((TOTAL + 1))

  local body
  body=$(curl -sL --max-time 10 "$url" 2>/dev/null) || {
    echo "FAIL: ${label} -- curl error fetching ${url}"
    FAILURES=$((FAILURES + 1))
    return
  }

  if [ -z "$body" ]; then
    echo "FAIL: ${label} -- empty response from ${url}"
    FAILURES=$((FAILURES + 1))
    return
  fi

  local nav_ok=0
  local content_ok=0

  if echo "$body" | grep -q "$nav_marker"; then
    nav_ok=1
  fi

  if echo "$body" | grep -q "$content_marker"; then
    content_ok=1
  fi

  if [ "$nav_ok" -eq 1 ] && [ "$content_ok" -eq 1 ]; then
    echo "PASS: ${label}"
    PASSES=$((PASSES + 1))
  else
    echo "FAIL: ${label}"
    [ "$nav_ok" -eq 0 ] && echo "      missing nav marker: ${nav_marker}"
    [ "$content_ok" -eq 0 ] && echo "      missing content marker: ${content_marker}"
    FAILURES=$((FAILURES + 1))
  fi
}

echo "Smoke testing ${BASE_URL} ..."
echo ""

# Each page: path, nav marker, content marker, label
check_page "index.html"   'id="shared-nav"' 'id="empty-state"'     "Today (index.html)"
check_page "compare.html" 'id="shared-nav"' 'id="compare-grid"'    "Compare (compare.html)"
check_page "map.html"     'id="shared-nav"' 'id="search-controls"' "Map (map.html)"
check_page "fun.html"     'id="shared-nav"' 'id="fun-content"'     "Fun (fun.html)"
check_page "updates.html" 'id="shared-nav"' 'id="updates-content"' "Updates (updates.html)"
check_page "quiz.html"    'id="shared-nav"' 'data-quiz-mode'       "Quiz (quiz.html)"

echo ""
echo "Results: ${PASSES}/${TOTAL} passed, ${FAILURES} failed"

if [ "$FAILURES" -gt 0 ]; then
  exit 1
fi

echo "All pages OK."
exit 0

#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/preflight.sh [--all-worktrees]

Checks git working tree cleanliness using:
  git status --porcelain=v1 --untracked-files=all

Default:
  Checks only the current repository root.

Options:
  --all-worktrees   Also check every linked git worktree for the same repository.
  -h, --help        Show this help text.

Exit codes:
  0 = clean
  1 = dirty (tracked/untracked non-ignored changes found)
  2 = usage or environment error
EOF
}

ALL_WORKTREES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --all-worktrees)
      ALL_WORKTREES=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if ! ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  echo "Not inside a git repository." >&2
  exit 2
fi

FAIL=0

check_tree() {
  local path="$1"
  local status_output
  status_output="$(git -C "$path" status --porcelain=v1 --untracked-files=all)"
  if [[ -n "$status_output" ]]; then
    echo "FAIL: ${path} has non-ignored changes"
    echo "$status_output"
    echo
    FAIL=1
  else
    echo "OK: ${path} is clean"
  fi
}

if [[ "$ALL_WORKTREES" -eq 1 ]]; then
  while IFS= read -r worktree_path; do
    if [[ -n "$worktree_path" ]]; then
      check_tree "$worktree_path"
    fi
  done < <(git -C "$ROOT" worktree list --porcelain | awk '/^worktree / {print substr($0, 10)}')
else
  check_tree "$ROOT"
fi

if [[ "$FAIL" -ne 0 ]]; then
  echo "Preflight failed: resolve or isolate changes before starting another agent."
  exit 1
fi

echo "Preflight passed."

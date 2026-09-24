#!/usr/bin/env bash
# Prints the next date-based release version (YYYY.M.PATCH) from the git tags.
set -euo pipefail
TODAY="$(date +%Y.%-m)"
LATEST="$(git tag --list "${TODAY}.*" 2>/dev/null | sort -V | tail -1)"
if [ -z "$LATEST" ]; then echo "${TODAY}.0";
else PATCH="${LATEST##*.}"; echo "${TODAY}.$((PATCH + 1))"; fi

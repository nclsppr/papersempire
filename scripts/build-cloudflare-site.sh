#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly REPOSITORY_ROOT
readonly OUTPUT_DIRECTORY="$REPOSITORY_ROOT/site"
readonly DOCS_OUTPUT_DIRECTORY="$REPOSITORY_ROOT/docs-site"

if [[ -L $OUTPUT_DIRECTORY ]]; then
  echo "refusing to replace a symbolic link: $OUTPUT_DIRECTORY" >&2
  exit 1
fi

if [[ -e $OUTPUT_DIRECTORY ]]; then
  rm -rf -- "$OUTPUT_DIRECTORY"
fi

if [[ -L $DOCS_OUTPUT_DIRECTORY ]]; then
  echo "refusing to replace a symbolic link: $DOCS_OUTPUT_DIRECTORY" >&2
  exit 1
fi

if [[ -e $DOCS_OUTPUT_DIRECTORY ]]; then
  rm -rf -- "$DOCS_OUTPUT_DIRECTORY"
fi

npm --prefix "$REPOSITORY_ROOT" run docs:build
"$REPOSITORY_ROOT/scripts/build-site.sh" "$OUTPUT_DIRECTORY" HEAD

#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly REPOSITORY_ROOT

usage() {
  echo "usage: build-site <output-directory> <git-revision>" >&2
  exit 64
}

[[ $# -eq 2 ]] || usage

output_directory=$1
revision=$(git -C "$REPOSITORY_ROOT" rev-parse --verify "${2}^{commit}")
[[ $revision =~ ^[0-9a-f]{40}$ ]] || {
  echo "revision must resolve to a complete lowercase Git commit" >&2
  exit 1
}
[[ ! -e $output_directory ]] || {
  echo "output directory already exists: $output_directory" >&2
  exit 1
}
[[ -d $REPOSITORY_ROOT/docs-site ]] || {
  echo "docs-site is missing; run npm run docs:build first" >&2
  exit 1
}

mkdir -p "$output_directory/docs"
cp "$REPOSITORY_ROOT/index.html" "$output_directory/index.html"
cp "$REPOSITORY_ROOT/robots.txt" "$output_directory/robots.txt"
cp "$REPOSITORY_ROOT/404.html" "$output_directory/404.html"
cp "$REPOSITORY_ROOT/site.webmanifest" "$output_directory/site.webmanifest"
cp "$REPOSITORY_ROOT/sitemap.xml" "$output_directory/sitemap.xml"
cp -R "$REPOSITORY_ROOT/assets" "$output_directory/assets"
# Les masters ImageGen/PNG et manifestes de production restent versionnés dans
# le dépôt pour la traçabilité, mais ne sont jamais téléchargés par le jeu.
# L'arbre de sortie vient d'être créé et est donc sûr à élaguer ici.
find "$output_directory/assets" -type d -name sources -prune -exec rm -rf -- {} +
cp -R "$REPOSITORY_ROOT/dashboard" "$output_directory/dashboard"
cp -R "$REPOSITORY_ROOT/docs-site/." "$output_directory/docs/"

node "$REPOSITORY_ROOT/scripts/build-lang-pages.mjs" \
  "$output_directory" \
  "${revision:0:8}"

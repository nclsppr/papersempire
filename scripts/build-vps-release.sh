#!/usr/bin/env bash

set -Eeuo pipefail

REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
readonly REPOSITORY_ROOT

usage() {
  echo "usage: build-vps-release <site-directory> <output-directory> <git-revision>" >&2
  exit 64
}

[[ $# -eq 3 ]] || usage

site_directory=$1
output_directory=$2
revision=$(git -C "$REPOSITORY_ROOT" rev-parse --verify "${3}^{commit}")
[[ $revision =~ ^[0-9a-f]{40}$ ]] || {
  echo "revision must resolve to a complete lowercase Git commit" >&2
  exit 1
}
[[ -d $site_directory ]] || {
  echo "site directory is missing: $site_directory" >&2
  exit 1
}

mkdir -p "$output_directory"

PAPERSEMPIRE_RELEASE_ROOT=$(cd "$site_directory" && pwd) \
PAPERSEMPIRE_RELEASE_REVISION="$revision" \
PAPERSEMPIRE_RELEASE_ARCHIVE="$output_directory/site.tar.gz" \
PAPERSEMPIRE_RELEASE_INVENTORY="$output_directory/routes.json" \
python3 - <<'PY'
from __future__ import annotations

import gzip
import hashlib
import json
import os
import stat
import tarfile
from pathlib import Path
from urllib.parse import quote

root = Path(os.environ["PAPERSEMPIRE_RELEASE_ROOT"])
revision = os.environ["PAPERSEMPIRE_RELEASE_REVISION"]
archive = Path(os.environ["PAPERSEMPIRE_RELEASE_ARCHIVE"])
inventory = Path(os.environ["PAPERSEMPIRE_RELEASE_INVENTORY"])
tar_path = archive.with_suffix("")

files: list[Path] = []
directories: list[Path] = []
total_size = 0
for path in sorted(root.rglob("*")):
    mode = path.lstat().st_mode
    if stat.S_ISDIR(mode):
        directories.append(path)
        continue
    if not stat.S_ISREG(mode):
        raise SystemExit(f"public archive contains a non-regular file: {path.relative_to(root)}")
    files.append(path)
    total_size += path.stat().st_size

if not files:
    raise SystemExit("public archive is empty")
if len(files) > 5000:
    raise SystemExit("public archive exceeds the 5000-file limit")
if total_size > 150 * 1024 * 1024:
    raise SystemExit("public archive exceeds the 150 MiB uncompressed limit")

with tarfile.open(tar_path, "w", format=tarfile.GNU_FORMAT) as output:
    root_info = tarfile.TarInfo("site")
    root_info.type = tarfile.DIRTYPE
    root_info.mode = 0o755
    root_info.uid = root_info.gid = 0
    root_info.mtime = 0
    output.addfile(root_info)

    for directory in directories:
        relative = directory.relative_to(root).as_posix()
        info = tarfile.TarInfo(f"site/{relative}")
        info.type = tarfile.DIRTYPE
        info.mode = 0o755
        info.uid = info.gid = 0
        info.mtime = 0
        output.addfile(info)

    for path in files:
        relative = path.relative_to(root).as_posix()
        info = tarfile.TarInfo(f"site/{relative}")
        info.mode = 0o644
        info.uid = info.gid = 0
        info.mtime = 0
        info.size = path.stat().st_size
        with path.open("rb") as source:
            output.addfile(info, source)

with archive.open("wb") as raw_output:
    with gzip.GzipFile(filename="", mode="wb", fileobj=raw_output, mtime=0) as compressed:
        with tar_path.open("rb") as source:
            while chunk := source.read(1024 * 1024):
                compressed.write(chunk)
tar_path.unlink()

archive_size = archive.stat().st_size
if archive_size > 75 * 1024 * 1024:
    raise SystemExit("public archive exceeds the 75 MiB compressed limit")

routes = []
seen_routes: set[str] = set()
for path in files:
    relative = path.relative_to(root).as_posix()
    if relative == "index.html":
        route = "/"
    elif relative.endswith("/index.html"):
        route = "/" + relative.removesuffix("index.html")
    else:
        route = "/" + relative
    route = quote(route, safe="/-._~")
    if route in seen_routes:
        raise SystemExit(f"duplicate public route: {route}")
    seen_routes.add(route)
    routes.append(
        {
            "bytes": path.stat().st_size,
            "file": relative,
            "path": route,
            "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            "status": 200,
        }
    )

value = {
    "contract": "vps-infra.route-inventory.v1",
    "schema": 1,
    "site": {
        "archive_bytes": archive_size,
        "archive_sha256": hashlib.sha256(archive.read_bytes()).hexdigest(),
        "file_count": len(files),
        "uncompressed_bytes": total_size,
    },
    "source": {
        "repository": "nclsppr/papersempire",
        "revision": revision,
    },
    "routes": routes,
}
inventory.write_text(
    json.dumps(value, ensure_ascii=True, separators=(",", ":"), sort_keys=True) + "\n",
    encoding="ascii",
)
PY

printf 'revision=%s\n' "$revision"
printf 'site_archive=%s\n' "$output_directory/site.tar.gz"
printf 'route_inventory=%s\n' "$output_directory/routes.json"

#!/usr/bin/env bash
set -euo pipefail
REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
TEST_DIRECTORY=$(mktemp -d "${TMPDIR:-/tmp}/papers-native-policy.XXXXXX")
trap 'rm -rf "$TEST_DIRECTORY"' EXIT
xcrun swiftc "$REPOSITORY_ROOT/ios/PapersEmpire/NativeGamePolicy.swift" "$REPOSITORY_ROOT/ios/Tests/main.swift" -o "$TEST_DIRECTORY/native-policy-tests"
"$TEST_DIRECTORY/native-policy-tests"
python3 "$REPOSITORY_ROOT/ios/Tests/validate-privacy.py"

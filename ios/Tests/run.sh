#!/usr/bin/env bash
set -euo pipefail
REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
NATIVE_TEST_SDK=$(xcrun --sdk macosx --show-sdk-path)
TEST_DIRECTORY=$(mktemp -d "${TMPDIR:-/tmp}/papers-native-core.XXXXXX")
trap 'rm -rf "$TEST_DIRECTORY"' EXIT
node "$REPOSITORY_ROOT/scripts/build-ios-assets.mjs"
xcrun --sdk macosx swiftc -sdk "$NATIVE_TEST_SDK" -parse-as-library -framework JavaScriptCore \
  "$REPOSITORY_ROOT/ios/PapersEmpire/NativeGamePolicy.swift" \
  "$REPOSITORY_ROOT/ios/PapersEmpire/NativeGameModels.swift" \
  "$REPOSITORY_ROOT/ios/PapersEmpire/NativeGameEngine.swift" \
  "$REPOSITORY_ROOT/ios/PapersEmpire/NativeGameStore.swift" \
  "$REPOSITORY_ROOT/ios/Tests/main.swift" -o "$TEST_DIRECTORY/native-core-tests"
"$TEST_DIRECTORY/native-core-tests" "$REPOSITORY_ROOT"
python3 "$REPOSITORY_ROOT/ios/Tests/validate-privacy.py"

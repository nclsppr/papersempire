#!/usr/bin/env bash
set -euo pipefail
REPOSITORY_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
node "$REPOSITORY_ROOT/scripts/build-ios-assets.mjs"
xcodebuild -project "$REPOSITORY_ROOT/ios/PapersEmpire.xcodeproj" -scheme PapersEmpire -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' -derivedDataPath "$REPOSITORY_ROOT/ios/build" CODE_SIGNING_ALLOWED=NO build

#!/usr/bin/env python3
"""Validate the current native privacy declaration and its target inclusion."""
import json
import plistlib
from pathlib import Path
import re
import subprocess

ios = Path(__file__).resolve().parents[1]
manifest_path = ios / "PapersEmpire/PrivacyInfo.xcprivacy"
with manifest_path.open("rb") as manifest_file:
    manifest = plistlib.load(manifest_file)
assert manifest == {
    "NSPrivacyTracking": False,
    "NSPrivacyTrackingDomains": [],
    "NSPrivacyCollectedDataTypes": [],
    "NSPrivacyAccessedAPITypes": [],
}, "Review the declared data practices when the native app's behavior changes"

project = json.loads(subprocess.check_output([
    "/usr/bin/plutil", "-convert", "json", "-o", "-",
    str(ios / "PapersEmpire.xcodeproj/project.pbxproj"),
]))["objects"]
target = next(value for value in project.values()
              if value.get("isa") == "PBXNativeTarget" and value.get("name") == "PapersEmpire")
resources = [project[phase] for phase in target["buildPhases"]
             if project[phase]["isa"] == "PBXResourcesBuildPhase"]
resource_refs = [project[project[build_file]["fileRef"]] for phase in resources
                 for build_file in phase.get("files", [])]
assert sum(ref.get("path") == "PrivacyInfo.xcprivacy" for ref in resource_refs) == 1, \
    "The app target must copy exactly one privacy manifest into its bundle"

# This deliberately narrow source gate catches additions to Apple's current
# required-reason API surface. It is not a substitute for a distribution scan.
# Reference: Apple NSPrivacyAccessedAPIType, reviewed 2026-09-07.
covered_symbols = re.compile(
    r"\b(?:UserDefaults|NSUserDefaults|AppStorage|systemUptime|mach_absolute_time|"
    r"activeInputModes|creationDate|modificationDate|fileModificationDate|"
    r"contentModificationDateKey|creationDateKey|volumeAvailableCapacityKey|"
    r"volumeAvailableCapacityForImportantUsageKey|volumeAvailableCapacityForOpportunisticUsageKey|"
    r"volumeTotalCapacityKey|systemFreeSize|systemSize|getattrlist|getattrlistbulk|"
    r"fgetattrlist|getattrlistat|stat|fstat|fstatat|lstat|statfs|statvfs|fstatfs|fstatvfs)\b"
)
for swift_file in (ios / "PapersEmpire").rglob("*.swift"):
    match = covered_symbols.search(swift_file.read_text())
    assert match is None, f"Review the privacy manifest for {match.group()} in {swift_file}"

print("Native privacy: no tracking/collected data, current API declarations and app resource inclusion passed.")

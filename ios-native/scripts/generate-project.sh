#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f Config/Local.xcconfig || ! -f Config/GeneratedBridgeConfig.swift ]]; then
  echo "Local configuration is missing. Create Config/Local.xcconfig from Config/Local.xcconfig.example and provide Config/GeneratedBridgeConfig.swift before generating the project." >&2
  exit 1
fi

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "xcodegen is missing. Install with: brew install xcodegen" >&2
  exit 127
fi

xcodegen generate

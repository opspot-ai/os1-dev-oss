#!/usr/bin/env bash
# Launch the OS1 PWA locally.
#
#   DEMO (no secrets — what you run to verify the shell):
#     ./scripts/serve.sh
#
# Use credentials from a secure local store or environment; never hard-code them in this script.
#     export ORGO_API_KEY="$(op item get '<orgo-item>' --vault 'REPLACE_WITH_VAULT_NAME' --fields credential)"
#     export ORGO_COMPUTER_ID="<computer-id>"
#     ./scripts/serve.sh
#
# Then on the iPhone (same Wi-Fi): open http://<this-mac-ip>:8790 in Safari,

set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-8790}"
echo "OS1 PWA -> http://localhost:${PORT}"
exec node server/proxy.mjs

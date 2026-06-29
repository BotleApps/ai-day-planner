#!/usr/bin/env bash
# =============================================================================
# wire-ios-oauth.sh — Substitute the reversed iOS OAuth client ID into Info.plist
#
# Usage:
#   ./scripts/wire-ios-oauth.sh com.googleusercontent.apps.123456789-abc
#
# After running this you must `npx cap sync ios` and rebuild in Xcode.
# =============================================================================
set -euo pipefail

REVERSED_CLIENT_ID="${1:-}"

if [ -z "$REVERSED_CLIENT_ID" ]; then
  echo "Usage: $0 <reversed-client-id>"
  echo
  echo "Get the reversed client ID from Google Cloud Console:"
  echo "  Credentials → your iOS OAuth client → 'iOS URL scheme'"
  echo "It looks like: com.googleusercontent.apps.123456789-abcdefg"
  exit 1
fi

# Sanity check the format — Google's reversed client IDs always start with this
if ! [[ "$REVERSED_CLIENT_ID" =~ ^com\.googleusercontent\.apps\.[A-Za-z0-9_-]+$ ]]; then
  echo "✗ '$REVERSED_CLIENT_ID' does not look like a reversed Google client ID."
  echo "  Expected: com.googleusercontent.apps.<your-id>"
  exit 1
fi

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PLIST="$ROOT/ios/App/App/Info.plist"

if [ ! -f "$PLIST" ]; then
  echo "✗ Info.plist not found at: $PLIST"
  echo "  Has the iOS platform been added? Run: npm run cap:add:ios"
  exit 1
fi

# Idempotent: replace the placeholder OR any previously-wired value
if grep -q "REPLACE_WITH_REVERSED_IOS_CLIENT_ID" "$PLIST"; then
  echo "→ Replacing placeholder in $PLIST"
  sed -i.bak "s|REPLACE_WITH_REVERSED_IOS_CLIENT_ID|$REVERSED_CLIENT_ID|" "$PLIST"
elif grep -q "com.googleusercontent.apps." "$PLIST"; then
  echo "→ Updating existing reversed client ID in $PLIST"
  sed -i.bak -E "s|com\.googleusercontent\.apps\.[A-Za-z0-9_-]+|$REVERSED_CLIENT_ID|" "$PLIST"
else
  echo "✗ Could not find CFBundleURLTypes block in $PLIST"
  echo "  The Info.plist may have been hand-edited. Add the block manually."
  exit 1
fi

rm -f "$PLIST.bak"

echo "✓ Wired $REVERSED_CLIENT_ID into Info.plist"
echo
echo "Next:"
echo "  1. npx cap sync ios"
echo "  2. Open ios/App/App.xcworkspace in Xcode and run"

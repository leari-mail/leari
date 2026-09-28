#!/usr/bin/env bash
# macOS only. Captures README screenshots of the app with fictional demo data:
#   docs/screenshots/leari-light.png, docs/screenshots/leari-dark.png
#
#   pnpm screenshots
#
# Runs a separate copy of the app (identifier com.leari.screenshots, dev server on port 1430),
# so it never shows your own mail and can run next to `pnpm app`. Its database starts empty
# each time and is filled by the dev seed (src/db/seed.ts). The window is brought to the front
# and its screen area captured (window-only capture misses the web view's layers), then framed
# with rounded corners and a shadow by scripts/window-frame.swift. macOS may ask for Screen
# Recording and Accessibility permission for your terminal the first time.
set -euo pipefail

cd "$(dirname "$0")/.."
OUT="$PWD/docs/screenshots"
IDENTIFIER="com.leari.screenshots"
PROFILE="$HOME/Library/Application Support/$IDENTIFIER"
PORT=1430
mkdir -p "$OUT"

capture() {
  local theme="$1"
  rm -rf "$PROFILE" "$HOME/Library/WebKit/$IDENTIFIER" "$HOME/Library/Caches/$IDENTIFIER"

  local config
  config=$(cat <<JSON
{
  "identifier": "$IDENTIFIER",
  "build": {
    "devUrl": "http://localhost:$PORT",
    "beforeDevCommand": "pnpm vite --port $PORT --strictPort"
  },
  "app": {
    "windows": [{
      "label": "main", "title": "Leari", "width": 1280, "height": 800, "center": true,
      "transparent": true, "skipTaskbar": true, "titleBarStyle": "Overlay", "hiddenTitle": true,
      "trafficLightPosition": { "x": 18, "y": 22 },
      "windowEffects": { "effects": ["sidebar"], "state": "followsWindowActiveState" },
      "url": "index.html?screenshot&theme=$theme&lang=en&open=0"
    }]
  }
}
JSON
)

  # Own process group, so we stop exactly this copy (not your `pnpm app`).
  perl -e 'setpgrp; exec @ARGV' pnpm tauri dev --config "$config" >"$OUT/.tauri-$theme.log" 2>&1 &
  group=$!
  # Always stop this copy (dev server + app), even if a step below fails.
  trap 'kill -- -"$group" 2>/dev/null || true' EXIT

  local app="" window=""
  for _ in $(seq 240); do
    app=$(pgrep -g "$group" -f "debug/leari" | head -1 || true)
    [ -n "$app" ] && window=$(swift scripts/window-id.swift "$app" 2>/dev/null || true)
    [ -n "$window" ] && break
    sleep 1
  done
  if [ -z "$window" ]; then
    echo "screenshots: window did not appear (see $OUT/.tauri-$theme.log)" >&2
    kill -- -"$group" 2>/dev/null || true
    exit 1
  fi

  sleep 15 # migrations, demo seed, first render
  osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $app) to true" >/dev/null
  sleep 2
  local area="${window#* }"
  local raw
  raw="$(mktemp -d)/leari-$theme.png"
  screencapture -x -R "$area" "$raw"
  swift scripts/window-frame.swift "$raw" "$OUT/leari-$theme.png"
  rm -rf "$(dirname "$raw")"
  echo "screenshots: $OUT/leari-$theme.png"

  kill -- -"$group" 2>/dev/null || true
  wait "$group" 2>/dev/null || true
}

capture light
capture dark
rm -f "$OUT"/.tauri-*.log

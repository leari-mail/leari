#!/usr/bin/env bash
# macOS only. Captures README screenshots of the app with fictional demo data, one per scene
# staged by src/hooks/app/useScreenshotMode.ts, as docs/screenshots/leari-<name>.png:
#   light, dark   the main window with a conversation open (README header)
#   composer      a formatted reply
#   selection     several conversations selected, with the right-click menu
#   drag          conversations being dragged onto a folder
#   folders       a custom folder's right-click menu
#
#   pnpm screenshots                  # all of them
#   pnpm screenshots composer drag    # just these
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
  local name="$1" theme="$2" scene="$3"
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
      "url": "index.html?screenshot&theme=$theme&lang=en&open=0&scene=$scene"
    }]
  }
}
JSON
)

  # Own process group, so we stop exactly this copy (not your `pnpm app`).
  perl -e 'setpgrp; exec @ARGV' pnpm tauri dev --config "$config" >"$OUT/.tauri-$name.log" 2>&1 &
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
    echo "screenshots: window did not appear (see $OUT/.tauri-$name.log)" >&2
    kill -- -"$group" 2>/dev/null || true
    exit 1
  fi

  sleep 15 # migrations, demo seed, first render
  osascript -e "tell application \"System Events\" to set frontmost of (first process whose unix id is $app) to true" >/dev/null
  sleep 2
  local area="${window#* }"
  local raw
  raw="$(mktemp -d)/leari-$name.png"
  screencapture -x -R "$area" "$raw"
  swift scripts/window-frame.swift "$raw" "$OUT/leari-$name.png"
  rm -rf "$(dirname "$raw")"
  echo "screenshots: $OUT/leari-$name.png"

  kill -- -"$group" 2>/dev/null || true
  wait "$group" 2>/dev/null || true
}

# name theme scene
shots=(
  "light light reader"
  "dark dark reader"
  "composer light composer"
  "selection light selection"
  "drag light drag"
  "folders light folders"
)
for shot in "${shots[@]}"; do
  read -r name theme scene <<<"$shot"
  if [ $# -gt 0 ] && [[ ! " $* " == *" $name "* ]]; then
    continue
  fi
  capture "$name" "$theme" "$scene"
done
rm -f "$OUT"/.tauri-*.log

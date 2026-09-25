#!/usr/bin/env bash
# Cargo runner for macOS (configured in src-tauri/.cargo/config.toml). Before running a dev
# build, signs it with the local "leari Development" identity (created on first use by
# scripts/dev-cert.sh), so macOS sees every rebuild as the same app and doesn't ask for
# Keychain access again. If signing isn't possible it just runs the binary.
dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
binary="$1"

if [[ "$(uname)" == "Darwin" ]]; then
  bash "$dir/dev-cert.sh" || true
  if security find-identity -p codesigning 2>/dev/null | grep -q '"leari Development"'; then
    codesign --force --sign "leari Development" --identifier com.leari.mail "$binary" 2>/dev/null ||
      echo "leari: could not sign $binary with \"leari Development\"" >&2
  fi
fi
exec "$@"

#!/usr/bin/env bash
# Cargo runner for macOS (configured in src-tauri/.cargo/config.toml): before running a dev
# build, signs it with the local "leari Development" identity (created by scripts/dev-cert.sh)
# so macOS sees every rebuild as the same app. Without that identity it just runs the binary.
binary="$1"
if security find-identity -p codesigning 2>/dev/null | grep -q '"leari Development"'; then
  codesign --force --sign "leari Development" --identifier com.leari.mail "$binary" 2>/dev/null ||
    echo "dev-run: could not sign $binary with \"leari Development\"" >&2
fi
exec "$@"

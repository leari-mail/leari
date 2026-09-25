#!/usr/bin/env bash
# macOS only. Creates a local, self-signed "leari Development" code-signing identity in your
# login keychain. Dev builds signed with it (see scripts/dev-run.sh) keep the same identity
# across rebuilds, so the Keychain's "Always Allow" for leari's saved passwords sticks.
#
# Runs automatically on the first `pnpm app`; `pnpm dev:cert` runs it by hand.
# The certificate does not need to be trusted (the Keychain matches the signature by
# certificate fingerprint), so no password is asked. Remove it any time in Keychain Access
# (search "leari Development").
set -euo pipefail

NAME="leari Development"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
OPENSSL=/usr/bin/openssl # LibreSSL: produces a PKCS#12 that `security import` accepts

if [[ "$(uname)" != "Darwin" ]]; then
  exit 0
fi
if security find-identity -p codesigning "$KEYCHAIN" 2>/dev/null | grep -q "\"$NAME\""; then
  exit 0
fi

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat > "$tmp/cert.cnf" <<CNF
[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = $NAME
[ext]
basicConstraints = critical,CA:false
keyUsage = critical,digitalSignature
extendedKeyUsage = critical,codeSigning
CNF

"$OPENSSL" req -x509 -newkey rsa:2048 -nodes -days 3650 -config "$tmp/cert.cnf" \
  -keyout "$tmp/key.pem" -out "$tmp/cert.pem" 2>/dev/null
"$OPENSSL" pkcs12 -export -inkey "$tmp/key.pem" -in "$tmp/cert.pem" -name "$NAME" \
  -out "$tmp/identity.p12" -passout pass:leari

security import "$tmp/identity.p12" -k "$KEYCHAIN" -P leari -T /usr/bin/codesign >/dev/null

echo "leari: created the \"$NAME\" signing identity for dev builds." >&2
echo "leari: next Keychain prompt, choose \"Always Allow\" (it will be the last one)." >&2

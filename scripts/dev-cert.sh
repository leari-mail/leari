#!/usr/bin/env bash
# macOS only. Creates a local, self-signed "leari Development" code-signing identity in your
# login keychain. Dev builds signed with it (see scripts/dev-run.sh) keep the same identity
# across rebuilds, so the Keychain's "Always Allow" for leari's saved passwords sticks.
#
#   pnpm dev:cert
#
# macOS asks for your password once, to trust the certificate for code signing.
# Remove it any time in Keychain Access (search "leari Development").
set -euo pipefail

NAME="leari Development"
KEYCHAIN="$HOME/Library/Keychains/login.keychain-db"
OPENSSL=/usr/bin/openssl # LibreSSL: produces a PKCS#12 that `security import` accepts

if [[ "$(uname)" != "Darwin" ]]; then
  echo "Only needed on macOS." && exit 0
fi
if security find-identity -p codesigning "$KEYCHAIN" | grep -q "\"$NAME\""; then
  echo "\"$NAME\" already exists." && exit 0
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
security add-trusted-cert -r trustRoot -p codeSign -k "$KEYCHAIN" "$tmp/cert.pem"

echo "Created \"$NAME\". Restart \`pnpm app\`; the next Keychain prompt is the last one if you choose \"Always Allow\"."

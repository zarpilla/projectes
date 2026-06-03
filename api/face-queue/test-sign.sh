#!/bin/bash

# Test script for debugging xmlsec1 signature
# Usage: ./test-sign.sh /path/to/cert.p12 password /path/to/unsigned.xml

CERT_P12="$1"
PASSWORD="$2"
UNSIGNED_XML="$3"

if [ -z "$CERT_P12" ] || [ -z "$UNSIGNED_XML" ]; then
    echo "Usage: $0 /path/to/cert.p12 password /path/to/unsigned.xml"
    exit 1
fi

TIMESTAMP=$(date +%s)
CERT_PEM="/tmp/cert_${TIMESTAMP}.pem"
KEY_PEM="/tmp/key_${TIMESTAMP}.pem"
SIGNED_XML="/tmp/signed_${TIMESTAMP}.xml"

echo "=== Extracting certificate and key from P12 ==="
openssl pkcs12 -in "$CERT_P12" -clcerts -nokeys -out "$CERT_PEM" -passin pass:"$PASSWORD" -passout pass:
echo "Certificate extracted to: $CERT_PEM"

openssl pkcs12 -in "$CERT_P12" -nocerts -nodes -out "$KEY_PEM" -passin pass:"$PASSWORD"
echo "Key extracted to: $KEY_PEM"

echo ""
echo "=== Certificate info ==="
openssl x509 -in "$CERT_PEM" -noout -subject -issuer -serial

echo ""
echo "=== Key info ==="
openssl rsa -in "$KEY_PEM" -noout -text | head -5

echo ""
echo "=== Signing with xmlsec1 ==="
xmlsec1 --sign \
    --privkey-pem "$KEY_PEM","$CERT_PEM" \
    --output "$SIGNED_XML" \
    "$UNSIGNED_XML"

if [ $? -eq 0 ]; then
    echo "✓ Signature successful!"
    echo "Signed XML: $SIGNED_XML"
    echo ""
    echo "=== Verifying signature ==="
    xmlsec1 --verify "$SIGNED_XML"
else
    echo "✗ Signature failed"
    exit 1
fi

# Cleanup
rm -f "$CERT_PEM" "$KEY_PEM"

echo ""
echo "Done. Signed XML at: $SIGNED_XML"

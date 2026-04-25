#!/bin/bash
# =====================================================
# SSL Certificate Generator for nginx (Linux/WSL)
# =====================================================
# Purpose: Generate self-signed SSL certificates for local development
# Usage: ./generate-certs.sh
# Note: For production, use Let's Encrypt or a trusted CA

set -e

# Configuration
CERT_PATH="./ssl"
CERT_NAME="nginx"
DAYS_VALID=365
COMMON_NAME="localhost"
KEY_BITS=2048

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}SSL Certificate Generator${NC}"
echo -e "${GREEN}========================================${NC}"

# Create ssl directory if it doesn't exist
if [ ! -d "$CERT_PATH" ]; then
    echo -e "${GREEN}Creating $CERT_PATH directory...${NC}"
    mkdir -p "$CERT_PATH"
fi

echo -e "CN: ${YELLOW}$COMMON_NAME${NC}"
echo -e "Valid for: ${YELLOW}$DAYS_VALID days${NC}"
echo -e "Key bits: ${YELLOW}$KEY_BITS${NC}"
echo ""

# Generate self-signed certificate and private key
echo -e "${GREEN}Generating self-signed SSL certificate...${NC}"
openssl req -x509 \
    -newkey rsa:$KEY_BITS \
    -keyout "$CERT_PATH/$CERT_NAME.key" \
    -out "$CERT_PATH/$CERT_NAME.crt" \
    -days $DAYS_VALID \
    -nodes \
    -subj "/CN=$COMMON_NAME"

echo -e "${GREEN}Done!${NC}"

# Set proper permissions
chmod 600 "$CERT_PATH/$CERT_NAME.key"
chmod 644 "$CERT_PATH/$CERT_NAME.crt"

echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}SSL Certificate Generation Complete!${NC}"
echo -e "${GREEN}========================================${NC}"

# Display certificate info
echo -e "\n${YELLOW}Certificate Details:${NC}"
openssl x509 -in "$CERT_PATH/$CERT_NAME.crt" -text -noout | grep -E "Subject:|Not Before|Not After|Public-Key"

echo -e "\n${YELLOW}Files Created:${NC}"
echo -e "  Certificate: ${GREEN}$CERT_PATH/$CERT_NAME.crt${NC}"
echo -e "  Private Key: ${GREEN}$CERT_PATH/$CERT_NAME.key${NC}"

echo -e "\n${YELLOW}Next Steps:${NC}"
echo "1. Run: docker-compose up"
echo "2. Access the application at: https://localhost"
echo "3. Browser will show security warning (expected for self-signed cert)"
echo ""
echo -e "${YELLOW}For Production:${NC}"
echo "- Use Let's Encrypt for free trusted certificates"
echo "- Update VITE_API_URL to https://your-domain.com"
echo "- See SSL_SETUP_GUIDE.md for more details"

#!/bin/bash

# RV Reservation Snagger - Deploy Script
# This script commits changes to GitHub and pushes a new Docker image to ghcr.io
#
# Usage:
#   ./deploy.sh                    # Full deploy: commit, push to GitHub, build & push to ghcr.io
#   ./deploy.sh "commit message"   # Full deploy with custom commit message
#   ./deploy.sh --local            # Build and run locally with docker compose
#   ./deploy.sh "message" --local  # Commit changes, then build and run locally

set -e  # Exit on error

GITHUB_USERNAME="mikesawayda-adaptivesoftware"
REPO_URL="https://github.com/mikesawayda-adaptivesoftware/RV-Reservation-Snagger.git"
APP_NAME="rv-reservation-snagger"
PORT=3088

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🏕️  RV Reservation Snagger - Deploy${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$SCRIPT_DIR"

echo -e "${YELLOW}📁 App directory: $APP_DIR${NC}"
echo ""

# Check for uncommitted changes
cd "$APP_DIR"
if [[ -z $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  No changes to commit${NC}"
else
    # Get commit message from user or use default
    if [ -z "$1" ]; then
        COMMIT_MSG="Update RV-Reservation-Snagger - $(date '+%Y-%m-%d %H:%M')"
        echo -e "${YELLOW}💬 Using default commit message: ${COMMIT_MSG}${NC}"
    else
        COMMIT_MSG="$1"
        echo -e "${YELLOW}💬 Commit message: ${COMMIT_MSG}${NC}"
    fi
    echo ""

    # Stage all changes
    echo -e "${BLUE}📦 Staging changes...${NC}"
    git add -A

    # Commit
    echo -e "${BLUE}✍️  Committing...${NC}"
    git commit -m "$COMMIT_MSG"

    # Push to GitHub
    echo -e "${BLUE}🚀 Pushing to GitHub...${NC}"
    git remote set-url origin ${REPO_URL} 2>/dev/null || git remote add origin ${REPO_URL}
    git push origin main
    echo -e "${GREEN}✅ GitHub updated successfully!${NC}"
fi
echo ""

# Login to GitHub Container Registry
echo -e "${BLUE}🔑 Logging into ghcr.io...${NC}"
if [ -z "$GITHUB_CR_PAT" ]; then
    echo -e "${RED}❌ Error: GITHUB_CR_PAT environment variable is not set!${NC}"
    echo -e "${YELLOW}Please set it with: export GITHUB_CR_PAT='your_token_here'${NC}"
    echo -e "${YELLOW}Get a token from: https://github.com/settings/tokens${NC}"
    echo -e "${YELLOW}Required scopes: write:packages, read:packages${NC}"
    exit 1
fi
echo "$GITHUB_CR_PAT" | docker login ghcr.io -u "$GITHUB_USERNAME" --password-stdin
echo -e "${GREEN}✅ Logged into ghcr.io${NC}"
echo ""

# Check for --local flag
if [[ "$1" == "--local" ]] || [[ "$2" == "--local" ]]; then
    echo -e "${BLUE}🐳 Building and running locally with docker compose...${NC}"
    cd "$APP_DIR"
    docker compose up --build
    exit 0
fi

# Build and push Docker image to ghcr.io
echo -e "${BLUE}🐳 Building Docker image for linux/amd64 and pushing to ghcr.io...${NC}"
cd "$APP_DIR"

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker buildx is not available. Please install it first.${NC}"
    exit 1
fi

# Create/use buildx builder
docker buildx create --name mybuilder --use 2>/dev/null || docker buildx use mybuilder 2>/dev/null || true

# Build and push
echo -e "${YELLOW}⏳ This may take a few minutes...${NC}"
docker buildx build --platform linux/amd64 -t ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest --push .

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}   ✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Display the Unraid setup instructions
echo ""
echo "========================================"
echo "   UNRAID DOCKER RUN COMMAND"
echo "========================================"
echo ""
echo "Copy and paste this command into your Unraid terminal:"
echo ""
echo "----------------------------------------"
cat << 'DOCKER_CMD'
docker pull ghcr.io/mikesawayda-adaptivesoftware/rv-reservation-snagger:latest && \
docker rm -f rv-reservation-snagger 2>/dev/null; \
docker run -d \
  --name rv-reservation-snagger \
  --restart unless-stopped \
  -p 3088:3000 \
  -e NODE_ENV=production \
  -e FIREBASE_PROJECT_ID='rv-reservation-snagger' \
  -e FIREBASE_PRIVATE_KEY='-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCpGQV0iPqC0sMx
81ycaXqKDoFwc6ZY83vQv3tKhfZosbbgKpA59E6pOMPSWTf252JZoUAZiP5z0wFC
yz3lzStoNNbB60xvzaLKEFLc3bcYGTAbIgGk1R6vlQytLZI1SnrNvU6fKQhKLtT1
16D+ajLTT0Ny11b5K2mbgaqJtmcnp3h690jle53kmtYy1RKbRBjehjGMbV5ZMK8Q
KiqWzEsDcGOAj4Ty5TAyFHsaxpl3jBZeaIwSxLvpDCnV68/OgDuNRk7+jjXiK9bJ
ecqeQ2J9BE47qq4orxjuVRPLLlY/uxPtyWJDN/4B49yHKS3LvpQDbLqVZJdrche2
gQ3L37ltAgMBAAECggEAFeoxvEwiV0EUXg1ho73BzVGa8eVzGhUYJ1IhmuNor2HU
xxGNFo20ghbivgilCaEsLFyLD6QjAgTHJY5si7M+3Gb4rDIf+l9mqRRbgNdVKtDc
3K9YEjIyo2PIPEtrJu/roW1W2qa5NdAC9oeHDGHcC2m63o/M7Eb1jVtNLELQ9KD4
OU/IW/RwtjAfmuGnvrIMAae/pjb+PEMjSLjAEoj3lRcYk9eUNRSPzEYHkd6nkX4v
cIlwP8WqbtrQGY3wqladvf8aKyon42S9eATAjf51XjRS9wuLXoLeQMJ/UATl1D/Z
tBs1HXt8QeAttlvoZiYyK02wXXO9eehTf+yC3sbSSwKBgQDU1fhTYzIRdnq7mJ50
XMEjIovYmqp3Us4o4aQItV5KuzlmsPNXsU41E72V4tquN4bohvaSImTCEhVoFU9R
kON+4d8T5A3x9iU2/fHVpo89p7DiTMwh+0SyL0wOse3GWwdlTa7zUZdw/hlD35z1
8mA3MWz6gqgTT5MB+x58JajDZwKBgQDLZEDm1pyoELlvlX0Nmn3+5BZmNRdjaGvZ
7pB6EEwatrhkPZqT7PoKwF2uh/vKNiBeNfCiTG1aKzMhSY3p2YGrEGEXnrA3sszF
9d9B2V3ey+avFyrKgbZFyJURBM96kHu+DwnstxsgNgmxdYpqwUiH93u2wWYHjEl/
2Y44CEWMCwKBgQCHeBHxcagCuXjxQvlIc2lzZZ/BpOBvxsL1/nkcGeUEiBrHJEYf
QPnYitIXPyeV0D4MbysuZLnhVQVPFJFCB4jlz/rffD7sDZIuaICvTq7JvZy2zc74
qihViglNKS+BG5uffUyoDvznrLSEISaU3Usklk8ZPGSitfmKPz5uIsJCbQKBgFOo
LLnF1DGcj2lCB2ms/d31WvE3LSOKM7Iz2eEbCvKB7V3tqMLnWgFKFj5PWFVX5gBa
F1vqK6BG3IT4iBKDkD4YQpdAgiKmvGtAMlAXY/Db1Up3MPaSW7JgSk/xtpUnEH6g
GOjwd4vMLjh7rC80yOyD8rK84YaBQUoA5epOHKz5AoGBAJ0SrGYrUOVINAW4jPMh
o94//+puBE8qf2kL2liZS0XHL23E4ikmUMGIvJ/4ev+s7yiusmxch+uh84kTPRTk
0UgF9s6A7gn0XYnPJmNNmiWgB2qU/KxWT351BEsWION4HmnSMwIV0LtdrO6lG3Qi
gLCC8vHxj/q20pMYZFEpft6b
-----END PRIVATE KEY-----' \
  -e FIREBASE_CLIENT_EMAIL='firebase-adminsdk-fbsvc@rv-reservation-snagger.iam.gserviceaccount.com' \
  -e RECREATION_GOV_API_KEY='8ab1bc8c-f1b6-4fb5-9f76-de0eda3a608b' \
  -e STRIPE_SECRET_KEY='sk_test_xxxxxxxxxxxx' \
  -e STRIPE_WEBHOOK_SECRET='whsec_xxxxxxxxxxxx' \
  -e SENDGRID_API_KEY='SG.xxxxxxxxxxxx' \
  -e SENDGRID_FROM_EMAIL='alerts@yourcampsitealerts.com' \
  -e FRONTEND_URL='http://192.168.0.248:3088' \
  ghcr.io/mikesawayda-adaptivesoftware/rv-reservation-snagger:latest
DOCKER_CMD
echo "----------------------------------------"
echo ""
echo "View logs: docker logs -f rv-reservation-snagger"
echo "Access at: http://192.168.0.248:3088"
echo ""


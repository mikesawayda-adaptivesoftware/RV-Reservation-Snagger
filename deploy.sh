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
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🖥️  UNRAID SETUP INSTRUCTIONS${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}FIRST TIME SETUP:${NC}"
echo ""
echo -e "  1. SSH into your Unraid server."
echo ""
echo -e "  2. Login to GitHub Container Registry (one-time setup):"
echo ""
echo -e "     ${GREEN}echo 'YOUR_GITHUB_PAT_HERE' | docker login ghcr.io -u ${GITHUB_USERNAME} --password-stdin${NC}"
echo ""
echo -e "  3. Pull the latest image:"
echo ""
echo -e "     ${GREEN}docker pull ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest${NC}"
echo ""
echo -e "  4. Stop/remove any old containers (if exists):"
echo ""
echo -e "     ${GREEN}docker rm -f ${APP_NAME} 2>/dev/null || true${NC}"
echo ""
echo -e "  5. Run the container:"
echo ""
echo -e "     ${GREEN}docker run -d \\${NC}"
echo -e "     ${GREEN}  --name ${APP_NAME} \\${NC}"
echo -e "     ${GREEN}  --restart unless-stopped \\${NC}"
echo -e "     ${GREEN}  -p ${PORT}:3000 \\${NC}"
echo -e "     ${GREEN}  -e NODE_ENV=production \\${NC}"
echo -e "     ${GREEN}  -e FIREBASE_PROJECT_ID='rv-reservation-snagger' \\${NC}"
echo -e "     ${GREEN}  -e FIREBASE_PRIVATE_KEY='YOUR_FIREBASE_PRIVATE_KEY' \\${NC}"
echo -e "     ${GREEN}  -e FIREBASE_CLIENT_EMAIL='firebase-adminsdk-fbsvc@rv-reservation-snagger.iam.gserviceaccount.com' \\${NC}"
echo -e "     ${GREEN}  -e RECREATION_GOV_API_KEY='YOUR_API_KEY' \\${NC}"
echo -e "     ${GREEN}  -e STRIPE_SECRET_KEY='sk_test_xxx' \\${NC}"
echo -e "     ${GREEN}  -e STRIPE_WEBHOOK_SECRET='whsec_xxx' \\${NC}"
echo -e "     ${GREEN}  -e SENDGRID_API_KEY='SG.xxx' \\${NC}"
echo -e "     ${GREEN}  -e SENDGRID_FROM_EMAIL='alerts@yourdomain.com' \\${NC}"
echo -e "     ${GREEN}  -e FRONTEND_URL='http://192.168.0.248:${PORT}' \\${NC}"
echo -e "     ${GREEN}  ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest${NC}"
echo ""
echo -e "  6. Watch logs:"
echo ""
echo -e "     ${GREEN}docker logs -f ${APP_NAME}${NC}"
echo ""
echo -e "${YELLOW}TO UPDATE (after future deploys):${NC}"
echo ""
echo -e "     ${GREEN}docker pull ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest${NC}"
echo -e "     ${GREEN}docker rm -f ${APP_NAME} 2>/dev/null || true${NC}"
echo -e "     ${GREEN}# Then run the docker run command above again${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   🌐 Access: http://192.168.0.248:${PORT}${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Create a helper script for Unraid
cat > "$APP_DIR/unraid-run.sh" << 'UNRAID_SCRIPT'
#!/bin/bash
# Run this on your Unraid server to start/update the container

APP_NAME="rv-reservation-snagger"
GITHUB_USERNAME="mikesawayda-adaptivesoftware"
PORT=3088

# Pull latest image
docker pull ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest

# Stop and remove existing container
docker rm -f ${APP_NAME} 2>/dev/null || true

# Run new container
docker run -d \
  --name ${APP_NAME} \
  --restart unless-stopped \
  -p ${PORT}:3000 \
  -e NODE_ENV=production \
  -e FIREBASE_PROJECT_ID='rv-reservation-snagger' \
  -e FIREBASE_PRIVATE_KEY="${FIREBASE_PRIVATE_KEY}" \
  -e FIREBASE_CLIENT_EMAIL='firebase-adminsdk-fbsvc@rv-reservation-snagger.iam.gserviceaccount.com' \
  -e RECREATION_GOV_API_KEY="${RECREATION_GOV_API_KEY}" \
  -e STRIPE_SECRET_KEY="${STRIPE_SECRET_KEY:-sk_test_xxx}" \
  -e STRIPE_WEBHOOK_SECRET="${STRIPE_WEBHOOK_SECRET:-whsec_xxx}" \
  -e SENDGRID_API_KEY="${SENDGRID_API_KEY:-}" \
  -e SENDGRID_FROM_EMAIL="${SENDGRID_FROM_EMAIL:-alerts@example.com}" \
  -e FRONTEND_URL="http://192.168.0.248:${PORT}" \
  ghcr.io/${GITHUB_USERNAME}/${APP_NAME}:latest

echo "Container started! Access at http://192.168.0.248:${PORT}"
docker logs -f ${APP_NAME}
UNRAID_SCRIPT

chmod +x "$APP_DIR/unraid-run.sh"
echo -e "${GREEN}📄 Created unraid-run.sh helper script${NC}"
echo ""

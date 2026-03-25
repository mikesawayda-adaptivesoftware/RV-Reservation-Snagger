#!/usr/bin/env pwsh

# RV Reservation Snagger - Deploy Script
# This script commits changes to GitHub and pushes a new Docker image to ghcr.io
#
# Usage:
#   .\deploy.ps1                    # Full deploy: commit, push to GitHub, build & push to ghcr.io
#   .\deploy.ps1 "commit message"   # Full deploy with custom commit message
#   .\deploy.ps1 -Local             # Build and run locally with docker compose
#   .\deploy.ps1 "message" -Local   # Commit changes, then build and run locally

param(
    [string]$CommitMessage = "",
    [switch]$Local = $false
)

$ErrorActionPreference = "Stop"

$GITHUB_USERNAME = "mikesawayda-adaptivesoftware"
$REPO_URL = "https://github.com/mikesawayda-adaptivesoftware/RV-Reservation-Snagger.git"
$APP_NAME = "rv-reservation-snagger"
$PORT = 3088

# Colors for output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

Write-ColorOutput "========================================" -Color Cyan
Write-ColorOutput "   🏕️  RV Reservation Snagger - Deploy" -Color Cyan
Write-ColorOutput "========================================" -Color Cyan
Write-Host ""

# Get the directory where this script is located
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$APP_DIR = $SCRIPT_DIR

Write-ColorOutput "📁 App directory: $APP_DIR" -Color Yellow
Write-Host ""

# Check for uncommitted changes
Set-Location $APP_DIR
$gitStatus = git status -s

if ([string]::IsNullOrWhiteSpace($gitStatus)) {
    Write-ColorOutput "⚠️  No changes to commit" -Color Yellow
} else {
    # Get commit message from parameter or use default
    if ([string]::IsNullOrWhiteSpace($CommitMessage)) {
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
        $COMMIT_MSG = "Update RV-Reservation-Snagger - $timestamp"
        Write-ColorOutput "💬 Using default commit message: $COMMIT_MSG" -Color Yellow
    } else {
        $COMMIT_MSG = $CommitMessage
        Write-ColorOutput "💬 Commit message: $COMMIT_MSG" -Color Yellow
    }
    Write-Host ""

    # Stage all changes
    Write-ColorOutput "📦 Staging changes..." -Color Cyan
    git add -A

    # Commit
    Write-ColorOutput "✍️  Committing..." -Color Cyan
    git commit -m $COMMIT_MSG

    # Push to GitHub
    Write-ColorOutput "🚀 Pushing to GitHub..." -Color Cyan
    try {
        git remote set-url origin $REPO_URL 2>$null
    } catch {
        git remote add origin $REPO_URL
    }
    git push origin main
    Write-ColorOutput "✅ GitHub updated successfully!" -Color Green
}
Write-Host ""

# Login to GitHub Container Registry
Write-ColorOutput "🔑 Logging into ghcr.io..." -Color Cyan
if ([string]::IsNullOrWhiteSpace($env:GITHUB_CR_PAT)) {
    Write-ColorOutput "❌ Error: GITHUB_CR_PAT environment variable is not set!" -Color Red
    Write-ColorOutput "Please set it with: `$env:GITHUB_CR_PAT='your_token_here'" -Color Yellow
    Write-ColorOutput "Get a token from: https://github.com/settings/tokens" -Color Yellow
    Write-ColorOutput "Required scopes: write:packages, read:packages" -Color Yellow
    exit 1
}
$env:GITHUB_CR_PAT | docker login ghcr.io -u $GITHUB_USERNAME --password-stdin
Write-ColorOutput "✅ Logged into ghcr.io" -Color Green
Write-Host ""

# Check for --local flag
if ($Local) {
    Write-ColorOutput "🐳 Building and running locally with docker compose..." -Color Cyan
    Set-Location $APP_DIR
    docker compose up --build
    exit 0
}

# Build and push Docker image to ghcr.io
Write-ColorOutput "🐳 Building Docker image for linux/amd64 and pushing to ghcr.io..." -Color Cyan
Set-Location $APP_DIR

# Check if buildx is available
$buildxVersion = docker buildx version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-ColorOutput "❌ Docker buildx is not available. Please install it first." -Color Red
    exit 1
}

# Create/use buildx builder
try {
    docker buildx create --name mybuilder --use 2>$null
} catch {
    try {
        docker buildx use mybuilder 2>$null
    } catch {
        # Builder already exists and is in use
    }
}

# Build and push
Write-ColorOutput "⏳ This may take a few minutes..." -Color Yellow
docker buildx build --platform linux/amd64 -t "ghcr.io/$GITHUB_USERNAME/${APP_NAME}:latest" --push .

Write-Host ""
Write-ColorOutput "========================================" -Color Green
Write-ColorOutput "   ✅ Deployment Complete!" -Color Green
Write-ColorOutput "========================================" -Color Green
Write-Host ""

# Display the Unraid setup instructions
Write-Host ""
Write-Host "========================================"
Write-Host "   UNRAID DOCKER RUN COMMAND"
Write-Host "========================================"
Write-Host ""
Write-Host "Copy and paste this command into your Unraid terminal:"
Write-Host ""
Write-Host "----------------------------------------"
Write-Host @"
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
"@
Write-Host "----------------------------------------"
Write-Host ""
Write-Host "View logs: docker logs -f rv-reservation-snagger"
Write-Host "Access at: http://192.168.0.248:3088"
Write-Host ""

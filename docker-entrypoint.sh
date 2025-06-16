#!/bin/bash
set -e

# Check if required environment variables are set
if [ -z "$CODEHOOKS_PROJECT_NAME" ]; then
    echo "Error: CODEHOOKS_PROJECT_NAME environment variable is required"
    exit 1
fi

if [ -z "$CODEHOOKS_ADMIN_TOKEN" ]; then
    echo "Error: CODEHOOKS_ADMIN_TOKEN environment variable is required"
    exit 1
fi

if [ -z "$CODEHOOKS_SPACE" ]; then
    echo "Error: CODEHOOKS_SPACE environment variable is required"
    exit 1
fi

exec node build/index.js 
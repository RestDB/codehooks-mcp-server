#!/bin/bash
set -e

# Check if required environment variables are set
if [ -z "$CODEHOOKS_PROJECT_ID" ]; then
    echo "Error: CODEHOOKS_PROJECT_ID environment variable is required"
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

echo "Starting MCP server..."
exec node build/index.js 
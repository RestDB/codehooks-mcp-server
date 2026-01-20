#!/bin/bash
set -e

# No required environment variables!
# - Admin token can be set via CODEHOOKS_ADMIN_TOKEN env var OR via set_admin_token tool
# - Project and space are set via set_project tool (reads from config.json)

if [ -z "$CODEHOOKS_ADMIN_TOKEN" ]; then
    echo "Note: CODEHOOKS_ADMIN_TOKEN not set. Use set_admin_token tool to configure."
    echo "To get a token, run 'coho add-admintoken' in your terminal."
fi

exec node build/index.js 
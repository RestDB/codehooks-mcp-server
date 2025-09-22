# Use Node.js 20 as base image
FROM node:20-slim

# Add MCP server metadata
LABEL io.modelcontextprotocol.server.name="io.github.restdb/codehooks-mcp"

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install codehooks CLI globally
RUN npm install -g codehooks

# Create app directory
WORKDIR /app

# Copy package files and source code
COPY package*.json tsconfig.json ./
COPY src ./src

# Create a non-root user
RUN useradd -m mcp && chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Create directory for temporary files
RUN mkdir -p /tmp/codehooks

# Install dependencies and build
RUN npm ci && npm run build

# Set environment variables
ENV NODE_ENV=production
ENV CODEHOOKS_SPACE=dev

# Add entrypoint script
COPY --chown=mcp:mcp docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"] 
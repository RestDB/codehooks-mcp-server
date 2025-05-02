# Use Node.js 20 as base image
FROM node:20-slim

# Install required system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install codehooks CLI globally
RUN npm install -g codehooks

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code and config files
COPY tsconfig.json ./
COPY src ./src

# Build the project
RUN npm run build

# Create a non-root user
RUN useradd -m mcp && chown -R mcp:mcp /app

# Switch to non-root user
USER mcp

# Create directory for temporary files
RUN mkdir -p /tmp/codehooks

# Set environment variables
ENV NODE_ENV=production
ENV CODEHOOKS_SPACE=dev

# Add entrypoint script
COPY --chown=mcp:mcp docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

ENTRYPOINT ["/app/docker-entrypoint.sh"] 
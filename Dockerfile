# Production Multi-Stage Dockerfile for PharmaCare Pro
FROM node:20-alpine AS builder

WORKDIR /usr/src/app

# Install dependencies (only production deps in final image)
COPY package*.json ./
RUN npm ci --omit=dev

# Final production runner image
FROM node:20-alpine AS runner

WORKDIR /usr/src/app
ENV NODE_ENV=production
ENV PORT=5000

# Create uploads directory with appropriate permissions
RUN mkdir -p uploads public && chown -R node:node /usr/src/app

# Copy dependencies and application code
COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --chown=node:node . .

# Run under non-privileged user for security
USER node

EXPOSE 5000

# Container healthcheck using native node fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.PORT || 5000) + '/health/live').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]


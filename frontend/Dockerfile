# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Bind to all interfaces inside the container; nginx upstream points
# at this hostname:port.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Next.js standalone output already contains a minimal node_modules
# tree, so we don't need to npm ci here. Copy the three pieces it
# needs.
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]

# ---- Stage 1: Build ----
FROM node:20-alpine AS builder

WORKDIR /app

# wget is needed by the runtime healthcheck; install in builder so the
# output stage can pull from the same alpine apk cache layer.
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Trim devDependencies after build so the production stage copies a
# pre-pruned tree. Keeps the final image small without re-running
# npm ci in the next stage.
RUN npm prune --omit=dev

# ---- Stage 2: Production ----
FROM node:20-alpine AS production

# wget for the docker-compose healthcheck. Alpine has no curl by
# default, wget is BusyBox so this is essentially free.
RUN apk add --no-cache wget tini

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Run as the unprivileged `node` user shipped with the base image.
USER node

EXPOSE 4000

# Tini reaps zombies and forwards signals so SIGTERM from docker stop
# actually shuts the Nest app down cleanly instead of getting eaten by
# the shell.
ENTRYPOINT ["/sbin/tini", "--", "./docker-entrypoint.sh"]

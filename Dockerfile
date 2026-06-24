# syntax=docker/dockerfile:1

# ---- Build stage: compile the SPA and the BFF server ----
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:server

# ---- Runtime stage: serve SPA + BFF (zero runtime npm deps) ----
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8084 \
    STATIC_DIR=/app/dist

COPY --from=build /app/dist ./dist
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/package.json ./package.json

USER node
EXPOSE 8084
CMD ["node", "server/dist/index.js"]

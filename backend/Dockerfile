# ─── Build stage: compile TypeScript → dist/ ───
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ─── Runtime stage: production deps only ───
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
# Init for clean signal handling (lets the store flush on SIGINT/SIGTERM)
RUN apk add --no-cache tini
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
# data/ is a mounted volume at runtime (durable JSON store lives here: /app/data)
EXPOSE 5000
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]

FROM node:22.20.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY backend/package.json backend/tsconfig.json ./backend/
COPY tooling/vendor ./tooling/vendor
RUN npm install --global npm@11.21.0
RUN npm ci --workspace backend
COPY backend/src ./backend/src
RUN npm run build --workspace backend
RUN npm prune --omit=dev --workspace backend

FROM node:22.20.0-bookworm-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/dist/entrypoints/api.js"]

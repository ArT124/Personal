# Optional: run anywhere that supports Docker (Koyeb, Fly.io, a VPS, your own PC).
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY server ./server
COPY public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=60s --timeout=5s CMD wget -qO- http://localhost:3000/healthz || exit 1
CMD ["node", "server/index.js"]

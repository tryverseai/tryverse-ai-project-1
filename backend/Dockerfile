FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Build TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S tryverse -u 1001

COPY --from=base /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package*.json ./

RUN mkdir -p logs && chown -R tryverse:nodejs /app
USER tryverse

EXPOSE 3001

# Runtime PORT is injected by Railway; default 3001 for local Docker. Node-based check (no wget dependency).
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "const p=process.env.PORT||3001;require('http').get('http://127.0.0.1:'+p+'/health',(r)=>{r.resume();process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["node", "dist/server.js"]

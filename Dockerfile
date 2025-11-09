FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci && npm cache clean --force

COPY . .

RUN npm run prisma:generate
RUN npm run build

FROM node:20-alpine AS production

RUN apk add --no-cache dumb-init curl

RUN addgroup -g 1001 -S nodejs
RUN adduser -S medcore -u 1001

WORKDIR /app

COPY --from=builder --chown=medcore:nodejs /app/dist ./dist
COPY --from=builder --chown=medcore:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=medcore:nodejs /app/prisma ./prisma
COPY --from=builder --chown=medcore:nodejs /app/package*.json ./

RUN npm prune --omit=dev
RUN npm install module-alias --production

USER medcore
EXPOSE 3004

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]


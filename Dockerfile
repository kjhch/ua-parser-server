# ---- 构建阶段:安装生产依赖 ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod

# ---- 运行阶段 ----
FROM node:24-alpine

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json server.js ./

USER node

CMD ["node", "server.js"]

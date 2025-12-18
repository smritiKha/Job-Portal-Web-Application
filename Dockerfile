# Multi-stage Dockerfile for Next.js (standalone output)
# 1) Base with PNPM enabled
FROM node:20-alpine AS base
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# 2) Deps: install node_modules using pnpm with frozen lockfile
FROM base AS deps
COPY pnpm-lock.yaml package.json ./
RUN pnpm install --frozen-lockfile

# 3) Builder: build the app
FROM base AS builder
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Ensure Next.js standalone output is enabled in next.config.mjs (output: 'standalone')
RUN pnpm build

# 4) Runner: copy standalone build
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# Create a non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy only the necessary build outputs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose port
EXPOSE 3000
ENV PORT=3000

# Run as non-root
USER nextjs

# Start the Next.js standalone server
CMD ["node", "server.js"]

# ─────────────────────────────────────────────────────────────────────────────
# Multi-stage Dockerfile for the OPG Weather App (Next.js 15)
#
# Stage 1 – deps     : install production + dev dependencies
# Stage 2 – builder  : compile the Next.js app (output: standalone)
# Stage 3 – runner   : minimal production image (~200 MB instead of ~1 GB)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM node:20-alpine AS deps

# libc6-compat is needed for Alpine to run some native Node.js modules
RUN apk add --no-cache libc6-compat

# Upgrade npm to match the version used locally (node:20-alpine ships with
# npm v10 which cannot read lockfileVersion 3 produced by npm v11+)
RUN npm install -g npm@latest

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci


# ── Stage 2: Build the application ───────────────────────────────────────────
FROM node:20-alpine AS builder

RUN npm install -g npm@latest

WORKDIR /app

# Copy installed node_modules from the deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy the rest of the source code
COPY . .

# Build — next.config.ts has output:'standalone' so .next/standalone is produced
RUN npm run build


# ── Stage 3: Production runner ────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Run as a non-root user for security
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the minimal standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Copy static assets (JS chunks, CSS, images)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# No public/ directory in this repo, so there is nothing extra to copy here.

USER nextjs

# Port the app listens on (override with -e PORT=xxxx if needed)
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# The standalone build produces a self-contained server.js
CMD ["node", "server.js"]

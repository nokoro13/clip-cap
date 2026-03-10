FROM node:20-alpine AS base

# Install system dependencies required for media processing and yt-dlp
RUN apk add --no-cache \
  ffmpeg \
  ca-certificates \
  fontconfig \
  python3 \
  py3-pip \
  yt-dlp

# Enable pnpm via corepack (matches your package.json config)
RUN corepack enable

WORKDIR /app

FROM base AS deps

WORKDIR /app

# Install JS dependencies with pnpm using the existing lockfile
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@9.15.9 --activate && pnpm install --frozen-lockfile

FROM deps AS build

WORKDIR /app

# Copy the rest of the source and build the Next.js app
COPY . .
ENV NODE_ENV=production
RUN pnpm build

FROM base AS runner

WORKDIR /app
ENV NODE_ENV=production

# Copy only what is needed to run the built Next.js app
COPY --from=build /app/.next ./.next
COPY --from=build /app/package.json ./package.json
COPY --from=deps /app/node_modules ./node_modules

EXPOSE 3000

# Start the production server
CMD ["pnpm", "start"]


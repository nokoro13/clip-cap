FROM node:20-alpine

# Install system dependencies and yt-dlp
RUN apk add --no-cache \
    ffmpeg \
    ca-certificates \
    fontconfig \
    python3 \
    py3-pip \
  && pip3 install --break-system-packages yt-dlp

WORKDIR /app

# Enable corepack so pnpm from packageManager can be used
RUN corepack enable

# Install dependencies using pnpm with lockfile
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the app
COPY . .

# Production build
ENV NODE_ENV=production
RUN pnpm run build

# Ensure Next.js binds to all interfaces in the container
ENV HOSTNAME=0.0.0.0

EXPOSE 3000

# Production server (next start respects PORT from Railway)
CMD ["pnpm", "run", "start"]


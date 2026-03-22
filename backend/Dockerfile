FROM node:20-bookworm-slim

WORKDIR /app

# Install OpenSSL for Prisma and clean up apt cache
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema before build so prisma generate works
COPY prisma ./prisma

# Copy source and tsconfig
COPY src ./src
COPY tsconfig.json ./
COPY *.d.ts ./

# Build app
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["npm", "start"]

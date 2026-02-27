# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Coolify passes environment variables as build args automatically.
# Vite needs VITE_* vars available during build to bake them into the JS bundle.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_BUNNY_STORAGE_KEY
ARG VITE_BUNNY_STORAGE_ZONE
ARG VITE_BUNNY_STORAGE_HOST
ARG VITE_BUNNY_PULL_ZONE
ARG GEMINI_API_KEY

# Make them available as env vars for the build step
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
ENV VITE_BUNNY_STORAGE_KEY=$VITE_BUNNY_STORAGE_KEY
ENV VITE_BUNNY_STORAGE_ZONE=$VITE_BUNNY_STORAGE_ZONE
ENV VITE_BUNNY_STORAGE_HOST=$VITE_BUNNY_STORAGE_HOST
ENV VITE_BUNNY_PULL_ZONE=$VITE_BUNNY_PULL_ZONE
ENV GEMINI_API_KEY=$GEMINI_API_KEY

# Copy dependency files first for better caching
COPY package.json package-lock.json .npmrc ./
RUN npm ci --legacy-peer-deps

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve with Caddy (matches Coolify's native setup)
FROM caddy:alpine

# Copy built assets
COPY --from=builder /app/dist /srv

# Caddy config: proper static file serving with SPA fallback
RUN echo ':3000 {' > /etc/caddy/Caddyfile && \
    echo '    root * /srv' >> /etc/caddy/Caddyfile && \
    echo '    encode gzip' >> /etc/caddy/Caddyfile && \
    echo '    try_files {path} /index.html' >> /etc/caddy/Caddyfile && \
    echo '    file_server' >> /etc/caddy/Caddyfile && \
    echo '    header /assets/* Cache-Control "public, max-age=31536000, immutable"' >> /etc/caddy/Caddyfile && \
    echo '    header /index.html Cache-Control "no-cache, no-store, must-revalidate"' >> /etc/caddy/Caddyfile && \
    echo '    header /version.json Cache-Control "no-cache, no-store, must-revalidate"' >> /etc/caddy/Caddyfile && \
    echo '}' >> /etc/caddy/Caddyfile

EXPOSE 3000

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]

# Stage 1: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

# Coolify passes environment variables as build args automatically.
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

# Stage 2: Serve using the exact same package that works locally
FROM node:20-alpine
WORKDIR /app

# Only copy what's needed for serving
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/serve.json ./
COPY --from=builder /app/dist ./dist

# Install only serve to keep the image small
RUN npm install -g serve

EXPOSE 3000

# Run exactly the same command as local `npm start`
CMD ["serve", "-c", "serve.json", "-l", "tcp://0.0.0.0:3000"]

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

# Stage 2: Serve using the Express proxy
FROM node:20-alpine
WORKDIR /app

# Install production dependencies for the Express server
COPY --from=builder /app/package.json /app/package-lock.json /app/.npmrc ./
RUN npm ci --omit=dev --legacy-peer-deps

# Copy the built app and the server script
COPY --from=builder /app/dist ./dist
COPY server.js ./

EXPOSE 3000

# Start the Express server
CMD ["node", "server.js"]

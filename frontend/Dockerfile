# Stage 1: Install dependencies and build the application
FROM node:20-slim AS builder

# Set working directory
WORKDIR /app/frontend

# Copy package.json and package-lock.json (or yarn.lock if you use Yarn)
COPY package.json package-lock.json* ./

# Install dependencies
# Using npm ci for cleaner installs, ensure package-lock.json is up to date
RUN npm ci

# Copy the rest of the application source code
COPY . .

# Build the Next.js application
# The NEXT_PUBLIC_BACKEND_URL should be available at build time if needed for static generation,
# or at runtime if used in client-side components or server components fetching data dynamically.
# For Cloud Run, runtime environment variables are preferred for flexibility.
RUN npm run build

# Stage 2: Production image
# Use a smaller base image for the production stage
FROM node:20-slim AS runner

WORKDIR /app/frontend

# Set environment to production
ENV NODE_ENV production
# ENV NEXT_TELEMETRY_DISABLED 1 # Optional: Disable Next.js telemetry

# Copy built assets from the builder stage
# Copy node_modules, .next (standalone output), public, package.json
# Next.js recommends a standalone output for optimized production deployments.
# To enable this, you would set `output: 'standalone'` in `next.config.mjs`.
# For now, we'll copy the standard build output. If standalone is enabled later, this part needs adjustment.

COPY --from=builder /app/frontend/public ./public
COPY --from=builder /app/frontend/.next ./.next
COPY --from=builder /app/frontend/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./package.json
# If next.config.ts (or .js/.mjs) is needed at runtime by the Next.js server, copy it too.
# Typically, for a standard `npm start`, it's not strictly needed unless it contains runtime config.
COPY --from=builder /app/frontend/next.config.ts ./next.config.ts


# Expose port 3000 (default for Next.js)
EXPOSE 3000

# Command to run the Next.js application
# This uses the `start` script from package.json, which is typically `next start`
CMD ["npm", "start"]
# Stage 1: Builder
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies for native Node modules (e.g., bcrypt)
RUN apk add --no-cache make gcc g++ python3

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build the NestJS app
RUN npm run build

# Stage 2: Production
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Copy only necessary artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

# Set environment variables (optional defaults)
ENV NODE_ENV=production
ENV PORT=3303

# Expose the app port
EXPOSE 3303

# Start the app
CMD ["node", "dist/main"]
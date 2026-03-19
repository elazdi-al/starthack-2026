FROM node:22-alpine

WORKDIR /app

# Install dependencies
COPY package*.json bun.lock ./
RUN npm ci

# Copy source and build Mastra
COPY mastra ./mastra
COPY greenhouse ./greenhouse
RUN npx mastra build

# Alpine compatibility for some native deps
RUN apk add --no-cache gcompat

# Add the Lambda Web Adapter
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter

# Run as non-root
RUN addgroup -g 1001 -S nodejs && \
  adduser -S mastra -u 1001 && \
  chown -R mastra:nodejs /app

USER mastra

# Adapter / app configuration
ENV PORT=8080
ENV NODE_ENV=production
ENV AWS_LWA_READINESS_CHECK_PATH="/api"

# Start the Mastra server
CMD ["node", ".mastra/output/index.mjs"]

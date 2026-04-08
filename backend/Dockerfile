FROM node:18-alpine

# Install ffmpeg for audio processing
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY --chown=node:node . .

# Create uploads directory
RUN mkdir -p uploads && chown -R node:node /app

# Drop root privileges at runtime
USER node

# Expose port
EXPOSE 5000

# Start the application
CMD ["npm", "start"]

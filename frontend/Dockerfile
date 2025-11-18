# Use Node.js
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install dependencies
RUN pnpm install

# Copy the rest of the code
COPY . .

# Expose the port
EXPOSE 5173

# Run in dev mode, ensuring it listens on 0.0.0.0
CMD ["pnpm", "run", "dev", "--host"]
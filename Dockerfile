FROM node:22-slim

# Build deps for better-sqlite3 native module
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# The postinstall script uses macOS Homebrew paths — skip it here.
# better-sqlite3 builds correctly via its own install scripts on Linux.
RUN npm pkg delete scripts.postinstall && npm ci

COPY . .

RUN npm run build

# Prune devDependencies (tsx is in dependencies, so it stays)
RUN npm prune --omit=dev

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["npm", "start"]

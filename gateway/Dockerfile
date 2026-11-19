FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

# The node image ships a non-root "node" user
USER node

# index.js reads $PORT (Cloud Run sets it); default 3001
EXPOSE 3001
CMD ["node", "index.js"]

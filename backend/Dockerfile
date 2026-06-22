FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine
WORKDIR /app
COPY --from=base /app/node_modules ./node_modules
COPY . .
RUN npm install -g tsx
RUN npx prisma generate

EXPOSE 5000
CMD ["sh", "-c", "npx prisma migrate deploy && node_modules/.bin/tsx src/index.ts"]

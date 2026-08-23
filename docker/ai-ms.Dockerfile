FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@finance/ai-ms

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/ai-ms/dist ./services/ai-ms/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/ai-ms/node_modules ./services/ai-ms/node_modules
COPY --from=build /app/libs ./libs
COPY --from=build /app/packages ./packages
WORKDIR /app/services/ai-ms
EXPOSE 3033
CMD ["node", "dist/main.js"]

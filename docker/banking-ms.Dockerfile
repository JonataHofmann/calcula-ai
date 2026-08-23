FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@finance/banking-ms

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/banking-ms/dist ./services/banking-ms/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/banking-ms/node_modules ./services/banking-ms/node_modules
COPY --from=build /app/libs ./libs
COPY --from=build /app/packages ./packages
WORKDIR /app/services/banking-ms
EXPOSE 3034
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@finance/bff

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/services/bff/dist ./services/bff/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/services/bff/node_modules ./services/bff/node_modules
COPY --from=build /app/libs ./libs
COPY --from=build /app/packages ./packages
WORKDIR /app/services/bff
EXPOSE 3032
CMD ["node", "dist/main.js"]

FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV CI=true
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@finance/admin

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/admin/.next ./apps/admin/.next
COPY --from=build /app/apps/admin/package.json ./apps/admin/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/admin/node_modules ./apps/admin/node_modules
WORKDIR /app/apps/admin
EXPOSE 3040
CMD ["npx", "next", "start"]

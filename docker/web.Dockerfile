FROM node:22-alpine AS base
RUN corepack enable pnpm
WORKDIR /app

FROM base AS build
ENV CI=true
# NEXT_PUBLIC_* precisa existir no ambiente DURANTE o build (embutido no bundle).
ARG NEXT_PUBLIC_BFF_URL=/bff
ARG NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX=true
ARG BFF_INTERNAL_URL=http://localhost:3032

ENV NEXT_PUBLIC_BFF_URL=$NEXT_PUBLIC_BFF_URL
ENV NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX=$NEXT_PUBLIC_PLUGGY_INCLUDE_SANDBOX
ENV BFF_INTERNAL_URL=$BFF_INTERNAL_URL

COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@finance/web

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/node_modules ./apps/web/node_modules
WORKDIR /app/apps/web
EXPOSE 3030
CMD ["npx", "next", "start"]

# Single image: builds the web app, then runs the API which also serves it.
# Pass VITE_FIREBASE_* as build args (Vite bakes them into the web app).
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
ENV MONGOMS_DISABLE_POSTINSTALL=1
RUN npm ci
COPY . .
ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_AUTH_ON_OWN_DOMAIN
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./
COPY client/package.json client/
COPY server/package.json server/
RUN npm ci --omit=dev -w server --include-workspace-root=false
COPY server server
COPY --from=build /app/client/dist client/dist
EXPOSE 3000
CMD ["node", "server/src/index.js"]

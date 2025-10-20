# syntax=docker/dockerfile:1

FROM node:24-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build -- --configuration=production

FROM nginx:stable-alpine3.21-perl

COPY --from=build /app/dist/BfUiBuilder/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
